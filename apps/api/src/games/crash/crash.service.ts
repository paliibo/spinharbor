import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CrashBetDto, CrashHistoryItem, CrashPlaceBetInput, CrashRoundDto } from '@spinharbor/contracts';
import { CrashBet, CrashRound, Prisma } from '@spinharbor/database';
import { CRASH_CONFIG, crashMultiplierAt, crashPayoutMinor, crashPointFromSeed, sha256Hex, SecureRng } from '@spinharbor/engines';
import { AuthPrincipal } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors/domain.errors';
import { DomainEvents } from '../../common/events/domain-events';
import { FINANCIAL_TX, PrismaService } from '../../common/prisma/prisma.service';
import type { Env } from '../../config/env';
import { WalletService } from '../../wallet/wallet.service';
import { GameplayService } from '../gameplay.service';
import { SessionsService } from '../sessions.service';

export const CRASH_GAME_SLUG = 'harbor-crash';
const TICK_MS = 100;

type BetRow = CrashBet & { user: { profile: { displayName: string } | null; username: string } };

/**
 * Server-driven multiplayer crash round loop.
 *
 * FSM: WAITING → BETTING_OPEN → RUNNING → CRASHED → SETTLED → (new round)
 * - The crash point is derived from a secret seed whose hash is published up-front.
 * - Every transition and every cash-out is validated against server time and persisted state;
 *   the client only renders what the server tells it. Multiplier ticks are informational.
 * - Only one API process should run the loop (single-instance assumption for this demo).
 */
@Injectable()
export class CrashService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CrashService.name);
  private readonly rng = new SecureRng();
  private current: CrashRound | null = null;
  private timers: NodeJS.Timeout[] = [];
  private tickTimer: NodeJS.Timeout | null = null;
  private gameId: string | null = null;
  private stopped = false;
  private autoQueue: { betId: string; userId: string; bp: number }[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameplay: GameplayService,
    private readonly sessions: SessionsService,
    private readonly wallet: WalletService,
    private readonly events: DomainEvents,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    if (!this.config.get('CRASH_LOOP_ENABLED')) return;
    const game = await this.prisma.casinoGame.findUnique({ where: { slug: CRASH_GAME_SLUG } });
    if (!game) {
      this.log.warn('Crash game not seeded; loop disabled');
      return;
    }
    this.gameId = game.id;
    await this.recoverUnfinishedRounds();
    await this.startRound();
  }

  onModuleDestroy() {
    this.stopped = true;
    this.clearTimers();
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  /** On boot, rounds interrupted by a restart are voided: open bets are refunded. */
  private async recoverUnfinishedRounds() {
    const unfinished = await this.prisma.crashRound.findMany({ where: { status: { not: 'SETTLED' } }, include: { bets: true } });
    for (const r of unfinished) {
      await this.prisma.$transaction(async (tx) => {
        for (const bet of r.bets) {
          if (bet.status !== 'PLACED') continue;
          const w = await this.gameplay.voidRound(tx, bet.gameRoundId, 'server restart');
          await tx.crashBet.update({ where: { id: bet.id }, data: { status: 'REFUNDED' } });
          if (w) this.wallet.publishWallet(w, 'refund');
        }
        await tx.crashRound.update({ where: { id: r.id }, data: { status: 'SETTLED', settledAt: new Date(), serverSeed: r.serverSeed ?? null } });
      });
    }
    if (unfinished.length) this.log.warn(`Recovered ${unfinished.length} unfinished crash round(s)`);
  }

  private schedule(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      if (!this.stopped) fn();
    }, Math.max(0, ms));
    this.timers.push(t);
  }

  async startRound() {
    if (this.stopped) return;
    const serverSeed = this.rng.seedHex(32);
    const now = Date.now();
    const bettingOpensAt = new Date(now + CRASH_CONFIG.waitingMs);
    const startsAt = new Date(bettingOpensAt.getTime() + CRASH_CONFIG.bettingWindowMs);
    const edge = await this.houseEdgeBp();
    this.current = await this.prisma.crashRound.create({
      data: { status: 'WAITING', crashMultiplierBp: crashPointFromSeed(serverSeed, edge), serverSeedHash: sha256Hex(serverSeed), serverSeed, bettingOpensAt, startsAt },
    });
    this.autoQueue = [];
    await this.broadcastState();
    this.schedule(() => this.openBetting(), bettingOpensAt.getTime() - Date.now());
  }

  private async houseEdgeBp(): Promise<number> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key: 'crashHouseEdgeBp' } });
    return typeof s?.value === 'number' ? s.value : CRASH_CONFIG.houseEdgeBp;
  }

  private async openBetting() {
    if (!this.current) return;
    this.current = await this.prisma.crashRound.update({ where: { id: this.current.id }, data: { status: 'BETTING_OPEN' } });
    await this.broadcastState();
    this.schedule(() => this.run(), this.current.startsAt.getTime() - Date.now());
  }

  private async run() {
    if (!this.current) return;
    const round = this.current;
    // Freeze auto cash-outs recorded during the betting window (they cannot change once running).
    const bets = await this.prisma.crashBet.findMany({ where: { crashRoundId: round.id, status: 'PLACED', autoCashoutBp: { not: null } } });
    this.autoQueue = bets.filter((b) => b.autoCashoutBp! < round.crashMultiplierBp).map((b) => ({ betId: b.id, userId: b.userId, bp: b.autoCashoutBp! })).sort((a, b) => a.bp - b.bp);
    this.current = await this.prisma.crashRound.update({ where: { id: round.id }, data: { status: 'RUNNING' } });
    await this.broadcastState();
    this.tickTimer = setInterval(() => void this.tick(), TICK_MS);
  }

  private ticking = false;
  private async tick() {
    if (!this.current || this.current.status !== 'RUNNING' || this.ticking) return;
    this.ticking = true;
    try {
      const round = this.current;
      const elapsed = Date.now() - round.startsAt.getTime();
      const bp = crashMultiplierAt(elapsed);
      while (this.autoQueue.length && this.autoQueue[0].bp <= bp) {
        const a = this.autoQueue.shift()!;
        await this.settleCashout(round, a.userId, a.bp, 'auto').catch((e) => this.log.warn(`auto cash-out failed: ${e.message}`));
      }
      if (bp >= round.crashMultiplierBp) {
        await this.crash();
        return;
      }
      this.events.publish('crash.tick', { roundId: round.id, multiplierBp: bp, elapsedMs: elapsed, serverTime: new Date().toISOString() });
    } finally {
      this.ticking = false;
    }
  }

  private async crash() {
    if (!this.current) return;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    const round = this.current;
    const crashedAt = new Date();
    this.current = await this.prisma.crashRound.update({ where: { id: round.id }, data: { status: 'CRASHED', crashedAt } });
    // Settle losing bets: their rounds are closed with zero payout.
    const losing = await this.prisma.crashBet.findMany({ where: { crashRoundId: round.id, status: 'PLACED' }, include: { gameRound: { include: { game: { select: { slug: true, name: true } } } } } });
    for (const bet of losing) {
      await this.prisma
        .$transaction(async (tx) => {
          const upd = await tx.crashBet.updateMany({ where: { id: bet.id, status: 'PLACED' }, data: { status: 'LOST' } });
          if (upd.count === 0) return;
          const settled = await this.gameplay.settleRound(tx, { round: bet.gameRound, payoutMinor: 0n, result: { crashMultiplierBp: round.crashMultiplierBp, cashedOut: false, autoCashoutBp: bet.autoCashoutBp }, bonusStakeMinor: bet.gameRound.bonusStakeMinor });
          this.gameplay.publishSettled(settled.round, settled.wallet, bet.userId);
        })
        .catch((e) => this.log.error(`settle lost bet ${bet.id}: ${e.message}`));
    }
    const history = await this.history();
    this.events.publish('crash.crashed', { roundId: round.id, crashMultiplierBp: round.crashMultiplierBp, serverSeed: round.serverSeed!, history });
    await this.broadcastState();
    this.schedule(() => void this.settleAndRestart(), CRASH_CONFIG.settleDelayMs);
  }

  private async settleAndRestart() {
    if (!this.current) return;
    await this.prisma.crashRound.update({ where: { id: this.current.id }, data: { status: 'SETTLED', settledAt: new Date() } });
    this.current = null;
    await this.startRound();
  }

  // ───────────── player actions ─────────────

  async placeBet(p: AuthPrincipal, input: CrashPlaceBetInput) {
    const round = this.current;
    if (!round || round.id !== input.roundId) throw Errors.roundClosed();
    if (round.status !== 'BETTING_OPEN' || Date.now() >= round.startsAt.getTime()) throw Errors.roundClosed();
    if (!this.gameId) throw Errors.gameUnavailable(CRASH_GAME_SLUG);
    const session = await this.sessions.create(p, CRASH_GAME_SLUG);
    const key = `${p.id}:${input.idempotencyKey}`;
    const existing = await this.prisma.crashBet.findUnique({ where: { crashRoundId_userId: { crashRoundId: round.id, userId: p.id } }, include: { user: { select: { username: true, profile: { select: { displayName: true } } } }, gameRound: true } });
    if (existing) {
      if (existing.gameRound.idempotencyKey === key) return { bet: this.toBetDto(existing), wallet: await this.wallet.getWallet(p.id) };
      throw Errors.conflict('DUPLICATE_BET', 'You already have a bet in this round');
    }
    let created: BetRow;
    let locked;
    try {
      const out = await this.prisma.$transaction(async (tx) => {
        const { round: gameRound, locked } = await this.gameplay.openStakedRound(tx, { principal: p, sessionId: session.id, engine: 'CRASH', stakeMinor: BigInt(input.stakeMinor), input: { autoCashoutBp: input.autoCashoutBp ?? null, crashRoundId: round.id }, idempotencyKey: input.idempotencyKey }, key);
        const bet = await tx.crashBet.create({
          data: { crashRoundId: round.id, userId: p.id, gameRoundId: gameRound.id, stakeMinor: BigInt(input.stakeMinor), autoCashoutBp: input.autoCashoutBp ?? null },
          include: { user: { select: { username: true, profile: { select: { displayName: true } } } } },
        });
        return { bet, locked };
      }, FINANCIAL_TX);
      created = out.bet;
      locked = out.locked;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw Errors.conflict('DUPLICATE_BET', 'You already have a bet in this round');
      throw e;
    }
    // Bets accepted only while the window is still open on the server clock (re-checked post-commit).
    if (this.current?.id !== round.id || this.current.status !== 'BETTING_OPEN') {
      const refunded = await this.prisma.$transaction(async (tx) => {
        await tx.crashBet.update({ where: { id: created.id }, data: { status: 'REFUNDED' } });
        return this.gameplay.voidRound(tx, created.gameRoundId, 'betting closed');
      });
      if (refunded) this.wallet.publishWallet(refunded, 'refund');
      throw Errors.roundClosed();
    }
    this.wallet.publishWallet(locked, 'crash_bet');
    const dto = this.toBetDto(created);
    this.events.publish('crash.bet', { roundId: round.id, bet: dto });
    return { bet: dto, wallet: this.gameplay.walletSlice(locked) };
  }

  async cashout(p: AuthPrincipal, roundId: string) {
    const round = this.current;
    if (!round || round.id !== roundId || round.status !== 'RUNNING') throw Errors.roundClosed();
    const elapsed = Date.now() - round.startsAt.getTime();
    const bp = crashMultiplierAt(elapsed);
    if (bp >= round.crashMultiplierBp) throw Errors.conflict('ROUND_CRASHED', 'Too late – the round already crashed');
    return this.settleCashout(round, p.id, bp, 'manual');
  }

  /** Atomic cash-out: the PLACED→CASHED_OUT update guards against duplicate requests. */
  private async settleCashout(round: CrashRound, userId: string, multiplierBp: number, mode: 'manual' | 'auto') {
    const out = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.crashBet.updateMany({ where: { crashRoundId: round.id, userId, status: 'PLACED' }, data: { status: 'CASHED_OUT', cashoutMultiplierBp: multiplierBp, cashedOutAt: new Date() } });
      if (upd.count === 0) throw Errors.conflict('NO_OPEN_BET', 'No open bet to cash out');
      const bet = await tx.crashBet.findUniqueOrThrow({ where: { crashRoundId_userId: { crashRoundId: round.id, userId } }, include: { user: { select: { username: true, profile: { select: { displayName: true } } } }, gameRound: { include: { game: { select: { slug: true, name: true } } } } } });
      const payout = crashPayoutMinor(bet.stakeMinor, multiplierBp);
      const settled = await this.gameplay.settleRound(tx, { round: bet.gameRound, payoutMinor: payout, result: { cashedOut: true, mode, cashoutMultiplierBp: multiplierBp, autoCashoutBp: bet.autoCashoutBp }, bonusStakeMinor: bet.gameRound.bonusStakeMinor });
      const updatedBet = await tx.crashBet.update({ where: { id: bet.id }, data: { payoutMinor: payout }, include: { user: { select: { username: true, profile: { select: { displayName: true } } } } } });
      return { bet: updatedBet, settled };
    }, FINANCIAL_TX);
    this.gameplay.publishSettled(out.settled.round, out.settled.wallet, userId);
    const dto = this.toBetDto(out.bet);
    this.events.publish('crash.cashout', { roundId: round.id, bet: dto });
    return { bet: dto, wallet: this.gameplay.walletSlice(out.settled.wallet) };
  }

  // ───────────── read model ─────────────

  toBetDto(b: BetRow): CrashBetDto {
    return {
      id: b.id,
      userId: b.userId,
      displayName: b.user.profile?.displayName ?? b.user.username,
      stakeMinor: Number(b.stakeMinor),
      autoCashoutBp: b.autoCashoutBp,
      status: b.status,
      cashoutMultiplierBp: b.cashoutMultiplierBp,
      payoutMinor: Number(b.payoutMinor),
    };
  }

  async snapshot(): Promise<CrashRoundDto | null> {
    const round = this.current ?? (await this.prisma.crashRound.findFirst({ orderBy: { seq: 'desc' } }));
    if (!round) return null;
    const bets = await this.prisma.crashBet.findMany({ where: { crashRoundId: round.id }, include: { user: { select: { username: true, profile: { select: { displayName: true } } } } }, orderBy: { createdAt: 'asc' } });
    const revealed = round.status === 'CRASHED' || round.status === 'SETTLED';
    return {
      id: round.id,
      seq: round.seq,
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      serverSeed: revealed ? round.serverSeed : null,
      crashMultiplierBp: revealed ? round.crashMultiplierBp : null,
      bettingOpensAt: round.bettingOpensAt.toISOString(),
      startsAt: round.startsAt.toISOString(),
      crashedAt: round.crashedAt?.toISOString() ?? null,
      serverTime: new Date().toISOString(),
      bets: bets.map((b) => this.toBetDto(b)),
    };
  }

  async history(take = 20): Promise<CrashHistoryItem[]> {
    const rows = await this.prisma.crashRound.findMany({ where: { status: { in: ['CRASHED', 'SETTLED'] }, crashedAt: { not: null } }, orderBy: { seq: 'desc' }, take });
    return rows.map((r) => ({ id: r.id, seq: r.seq, crashMultiplierBp: r.crashMultiplierBp, crashedAt: r.crashedAt!.toISOString() }));
  }

  async myBets(userId: string, take = 20) {
    const rows = await this.prisma.crashBet.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take, include: { crashRound: { select: { seq: true, crashMultiplierBp: true, status: true } } } });
    return rows.map((b) => ({ id: b.id, roundSeq: b.crashRound.seq, stakeMinor: Number(b.stakeMinor), status: b.status, cashoutMultiplierBp: b.cashoutMultiplierBp, payoutMinor: Number(b.payoutMinor), crashMultiplierBp: b.crashRound.status === 'SETTLED' || b.crashRound.status === 'CRASHED' ? b.crashRound.crashMultiplierBp : null, createdAt: b.createdAt.toISOString() }));
  }

  private async broadcastState() {
    const s = await this.snapshot();
    if (s) this.events.publish('crash.state', { round: s });
  }
}
