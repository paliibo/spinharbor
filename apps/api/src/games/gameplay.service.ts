import { Inject, Injectable } from '@nestjs/common';
import type { GameRoundDto, PlayRoundResponse } from '@spinharbor/contracts';
import { GameEngine, GameRound, Prisma } from '@spinharbor/database';
import { Rng, sha256Hex } from '@spinharbor/engines';
import { BonusesService } from '../bonuses/bonuses.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { FINANCIAL_TX, PrismaService, Tx } from '../common/prisma/prisma.service';
import { RNG } from '../common/rng/rng.module';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { LimitsService } from '../risk/limits.service';
import { UsersService } from '../users/users.service';
import { LockedWallet, WalletService } from '../wallet/wallet.service';

export interface OpenRoundInput {
  principal: AuthPrincipal;
  sessionId: string;
  engine: GameEngine;
  stakeMinor: bigint;
  input: Record<string, unknown>;
  idempotencyKey: string;
}

type RoundWithGame = GameRound & { game: { slug: string; name: string } };

/**
 * Orchestrates a financially-safe game round:
 *   validate player & session → lock wallet → create round → debit stake → provider computes
 *   outcome → credit payout → settle round → loyalty / wagering side effects → commit → events.
 * Everything up to commit happens in ONE database transaction; a failure anywhere rolls back the
 * stake, the round and all side effects together.
 */
@Injectable()
export class GameplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly users: UsersService,
    private readonly limits: LimitsService,
    private readonly loyalty: LoyaltyService,
    private readonly bonuses: BonusesService,
    private readonly providers: ProviderRegistry,
    private readonly events: DomainEvents,
    @Inject(RNG) private readonly rng: Rng,
  ) {}

  toRoundDto(r: RoundWithGame): GameRoundDto {
    return {
      id: r.id,
      sessionId: r.sessionId,
      gameId: r.gameId,
      gameSlug: r.game.slug,
      gameName: r.game.name,
      engine: r.engine,
      status: r.status,
      stakeMinor: Number(r.stakeMinor),
      payoutMinor: Number(r.payoutMinor),
      input: r.input,
      result: r.result,
      rngSeedHash: r.rngSeedHash,
      createdAt: r.createdAt.toISOString(),
      settledAt: r.settledAt?.toISOString() ?? null,
    };
  }

  private roundKey(userId: string, key: string) {
    return `${userId}:${key}`;
  }

  /** Instant-settle round (slots, dice, roulette). */
  async playInstant(input: OpenRoundInput): Promise<PlayRoundResponse> {
    const key = this.roundKey(input.principal.id, input.idempotencyKey);
    const replay = await this.findReplay(key, input.principal.id);
    if (replay) return replay;

    let outcome: { round: RoundWithGame; wallet: LockedWallet; points: number } | undefined;
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        const { round, session, game, locked } = await this.openStakedRound(tx, input, key);
        const provider = await this.providers.resolve(game.provider.code);
        const seed = this.rng.seedHex(16);
        const result = await provider.playRound({ engine: input.engine, roundId: round.id, stakeMinor: input.stakeMinor, input: input.input, rng: this.rng });
        const settled = await this.settleRound(tx, { round, payoutMinor: result.payoutMinor, result: result.result, locked, seedHash: sha256Hex(seed), bonusStakeMinor: round.bonusStakeMinor });
        await tx.gameSession.update({ where: { id: session.id }, data: { lastActivityAt: new Date() } });
        return settled;
      }, FINANCIAL_TX);
    } catch (e) {
      // Two concurrent requests with the same idempotency key: the loser of the unique-constraint
      // race returns the winner's result instead of charging the player twice.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target ?? '').includes('idempotencyKey')) {
        const r = await this.findReplay(key, input.principal.id);
        if (r) return r;
      }
      throw e;
    }
    this.publishSettled(outcome.round, outcome.wallet, input.principal.id);
    return { round: this.toRoundDto(outcome.round), wallet: this.walletSlice(outcome.wallet), loyaltyPointsAwarded: outcome.points };
  }

  /**
   * Opens a round and debits the stake (used by instant games and by crash bet placement).
   * Performs every authoritative check: account status, session, game availability, bet range,
   * limits and balance.
   */
  async openStakedRound(tx: Tx, input: OpenRoundInput, key = this.roundKey(input.principal.id, input.idempotencyKey)) {
    const userId = input.principal.id;
    await this.users.assertCanPlay(tx, userId);
    const session = await tx.gameSession.findUnique({ where: { id: input.sessionId }, include: { game: { include: { provider: true } } } });
    if (!session || session.userId !== userId || session.status !== 'ACTIVE') throw Errors.sessionInvalid();
    const game = session.game;
    if (game.status !== 'ACTIVE' || game.engine !== input.engine) throw Errors.gameUnavailable(game.slug);
    if (game.provider.status !== 'OPERATIONAL') throw Errors.conflict('PROVIDER_UNAVAILABLE', `Provider ${game.provider.name} is unavailable`);
    const maxBetSetting = await tx.systemSetting.findUnique({ where: { key: 'maxBetMinor' } });
    const maxBet = maxBetSetting ? BigInt(maxBetSetting.value as number) : game.maxBetMinor;
    if (input.stakeMinor < game.minBetMinor || input.stakeMinor > (maxBet < game.maxBetMinor ? maxBet : game.maxBetMinor)) throw Errors.betOutOfRange(game.minBetMinor, maxBet < game.maxBetMinor ? maxBet : game.maxBetMinor);
    await this.limits.assertWagerAllowed(tx, userId, input.stakeMinor, session);

    const locked = await this.wallet.lockWallet(tx, userId);
    const round = await tx.gameRound.create({
      data: { sessionId: session.id, userId, gameId: game.id, engine: game.engine, stakeMinor: input.stakeMinor, input: input.input as Prisma.InputJsonValue, idempotencyKey: key },
      include: { game: { select: { slug: true, name: true } } },
    });
    const debit = await this.wallet.debitStake(tx, { userId, stakeMinor: input.stakeMinor, roundId: round.id, description: `${game.name} – stake` }, locked);
    await tx.gameRoundTransaction.create({ data: { roundId: round.id, type: 'STAKE', amountMinor: input.stakeMinor, journalEntryId: debit.entry!.id } });
    const withBonus = await tx.gameRound.update({ where: { id: round.id }, data: { bonusStakeMinor: debit.bonusPart }, include: { game: { select: { slug: true, name: true } } } });
    await this.bonuses.progressWagering(tx, userId, input.stakeMinor, round.id);
    const afterWagering = await this.wallet.lockWallet(tx, userId);
    return { round: withBonus, session, game, locked: afterWagering };
  }

  /** Credits the payout (if any), marks the round settled and applies side effects. */
  async settleRound(tx: Tx, args: { round: RoundWithGame; payoutMinor: bigint; result: Record<string, unknown>; locked?: LockedWallet; seedHash?: string; bonusStakeMinor: bigint }) {
    const { round } = args;
    const current = await tx.gameRound.findUniqueOrThrow({ where: { id: round.id }, select: { status: true } });
    if (current.status !== 'OPEN') throw Errors.conflict('ROUND_ALREADY_SETTLED', 'Round already settled');
    let wallet = args.locked ?? (await this.wallet.lockWallet(tx, round.userId));
    if (args.payoutMinor > 0n) {
      // Winnings from bonus-funded stakes go back to the bonus balance pro rata.
      const bonusPart = round.stakeMinor > 0n ? (args.payoutMinor * args.bonusStakeMinor) / round.stakeMinor : 0n;
      const credit = await this.wallet.creditPayout(tx, { userId: round.userId, payoutMinor: args.payoutMinor, bonusPartMinor: bonusPart, roundId: round.id, description: `${round.game.name} – win` }, wallet);
      if (credit?.entry) {
        await tx.gameRoundTransaction.create({ data: { roundId: round.id, type: 'PAYOUT', amountMinor: args.payoutMinor, journalEntryId: credit.entry.id } });
        wallet = credit.wallet;
      }
    }
    const settled = await tx.gameRound.update({
      where: { id: round.id },
      data: { status: 'SETTLED', payoutMinor: args.payoutMinor, result: args.result as Prisma.InputJsonValue, rngSeedHash: args.seedHash, settledAt: new Date() },
      include: { game: { select: { slug: true, name: true } } },
    });
    await Promise.all([
      tx.gameSession.update({ where: { id: round.sessionId }, data: { roundsCount: { increment: 1 }, totalStakedMinor: { increment: round.stakeMinor }, totalPaidMinor: { increment: args.payoutMinor } } }),
      tx.casinoGame.update({ where: { id: round.gameId }, data: { playCount: { increment: 1 } } }),
      tx.playerRecentGame.upsert({ where: { userId_gameId: { userId: round.userId, gameId: round.gameId } }, create: { userId: round.userId, gameId: round.gameId }, update: { lastPlayedAt: new Date() } }),
    ]);
    const loyalty = await this.loyalty.awardForRound(tx, round.userId, round.id, round.stakeMinor);
    return { round: settled, wallet, points: loyalty.points };
  }

  /** Voids an OPEN round and refunds the stake (e.g. crash round aborted). */
  async voidRound(tx: Tx, roundId: string, reason: string) {
    const round = await tx.gameRound.findUniqueOrThrow({ where: { id: roundId }, include: { game: { select: { slug: true, name: true } } } });
    if (round.status !== 'OPEN') return null;
    const w = await this.wallet.lockWallet(tx, round.userId);
    const refund = await this.wallet.applyMovement(
      tx,
      {
        userId: round.userId,
        type: 'REFUND',
        description: `${round.game.name} – refund (${reason})`,
        idempotencyKey: `refund:${round.id}`,
        referenceType: 'game_round',
        referenceId: round.id,
        cashDeltaMinor: round.stakeMinor - round.bonusStakeMinor,
        bonusDeltaMinor: round.bonusStakeMinor,
        houseAccount: 'HOUSE_GAMING',
      },
      w,
    );
    if (refund.entry) await tx.gameRoundTransaction.create({ data: { roundId: round.id, type: 'REFUND', amountMinor: round.stakeMinor, journalEntryId: refund.entry.id } });
    await tx.gameRound.update({ where: { id: round.id }, data: { status: 'VOIDED', settledAt: new Date(), result: { voided: reason } } });
    return refund.wallet;
  }

  async findReplay(key: string, userId: string): Promise<PlayRoundResponse | null> {
    const round = await this.prisma.gameRound.findUnique({ where: { idempotencyKey: key }, include: { game: { select: { slug: true, name: true } } } });
    if (!round || round.userId !== userId) return null;
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return { round: this.toRoundDto(round), wallet: { balanceMinor: Number(w.balanceMinor), bonusBalanceMinor: Number(w.bonusBalanceMinor), version: w.version }, loyaltyPointsAwarded: 0 };
  }

  walletSlice(w: LockedWallet) {
    return { balanceMinor: Number(w.balanceMinor), bonusBalanceMinor: Number(w.bonusBalanceMinor), version: w.version };
  }

  publishSettled(round: RoundWithGame, wallet: LockedWallet, userId: string) {
    this.wallet.publishWallet(wallet, `round:${round.engine.toLowerCase()}`);
    this.prisma.user
      .findUnique({ where: { id: userId }, select: { username: true } })
      .then((u) => this.events.publish('round.settled', { userId, roundId: round.id, engine: round.engine, gameSlug: round.game.slug, gameName: round.game.name, stakeMinor: round.stakeMinor, payoutMinor: round.payoutMinor, username: u?.username ?? '' }))
      .catch(() => undefined);
  }
}
