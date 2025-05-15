import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WalletDto, WalletSummaryDto } from '@spinharbor/contracts';
import { JournalEntryType, LedgerAccountType, Prisma } from '@spinharbor/database';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { creditsToMinor, startOfUtcDay } from '../common/money/money';
import { FINANCIAL_TX, PrismaService, Tx } from '../common/prisma/prisma.service';
import type { Env } from '../config/env';
import { LedgerService } from '../ledger/ledger.service';

export interface LockedWallet {
  id: string;
  userId: string;
  balanceMinor: bigint;
  bonusBalanceMinor: bigint;
  version: number;
  cashAccountId: string;
  bonusAccountId: string;
}

export interface MovementInput {
  userId: string;
  type: JournalEntryType;
  description: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  reversalOfId?: string;
  createdById?: string | null;
  metadata?: Record<string, unknown>;
  /** Signed change to the player's cash balance. */
  cashDeltaMinor: bigint;
  /** Signed change to the player's bonus balance. */
  bonusDeltaMinor: bigint;
  /** House account taking the opposite side. */
  houseAccount: LedgerAccountType;
}

export interface MovementResult {
  entry: { id: string } | null;
  wallet: LockedWallet;
}

const TOPUP_TYPES: JournalEntryType[] = ['DEMO_RESET', 'INITIAL_FUNDING'];

/**
 * The wallet is the single write path for player balances. Every change:
 *  1. locks the wallet row (SELECT ... FOR UPDATE) inside the caller's transaction,
 *  2. validates the resulting balance is never negative,
 *  3. posts a balanced journal entry,
 *  4. updates the cached balance + version.
 * Concurrent requests for the same user serialise on the row lock, so double-spending is impossible.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly events: DomainEvents,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get initialCreditsMinor(): bigint {
    return creditsToMinor(this.config.get('INITIAL_DEMO_CREDITS'));
  }

  async lockWallet(tx: Tx, userId: string): Promise<LockedWallet> {
    const rows = await tx.$queryRaw<LockedWallet[]>`
      SELECT id, "userId", "balanceMinor", "bonusBalanceMinor", version, "cashAccountId", "bonusAccountId"
      FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const w = rows[0];
    if (!w) throw Errors.notFound('Wallet');
    return { ...w, balanceMinor: BigInt(w.balanceMinor), bonusBalanceMinor: BigInt(w.bonusBalanceMinor) };
  }

  async applyMovement(tx: Tx, input: MovementInput, locked?: LockedWallet): Promise<MovementResult> {
    const w = locked ?? (await this.lockWallet(tx, input.userId));
    const newCash = w.balanceMinor + input.cashDeltaMinor;
    const newBonus = w.bonusBalanceMinor + input.bonusDeltaMinor;
    if (newCash < 0n || newBonus < 0n) {
      throw Errors.insufficientBalance(-(input.cashDeltaMinor + input.bonusDeltaMinor), w.balanceMinor + w.bonusBalanceMinor);
    }
    const houseDelta = -(input.cashDeltaMinor + input.bonusDeltaMinor);
    if (input.cashDeltaMinor === 0n && input.bonusDeltaMinor === 0n) return { entry: null, wallet: w };

    const entry = await this.ledger.postEntry(tx, {
      type: input.type,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reversalOfId: input.reversalOfId,
      createdById: input.createdById,
      metadata: input.metadata,
      lines: [
        { accountId: w.cashAccountId, amountMinor: input.cashDeltaMinor, balanceAfterMinor: newCash },
        { accountId: w.bonusAccountId, amountMinor: input.bonusDeltaMinor, balanceAfterMinor: newBonus },
        { accountId: this.ledger.houseAccountId(input.houseAccount), amountMinor: houseDelta },
      ],
    });
    const updated = await tx.wallet.update({
      where: { id: w.id },
      data: { balanceMinor: newCash, bonusBalanceMinor: newBonus, version: { increment: 1 } },
      select: { version: true },
    });
    return { entry, wallet: { ...w, balanceMinor: newCash, bonusBalanceMinor: newBonus, version: updated.version } };
  }

  /** Creates ledger accounts + wallet and funds it with the initial demo credits. */
  async openWallet(tx: Tx, userId: string, initialCredits: number) {
    const cash = await tx.ledgerAccount.create({ data: { type: 'PLAYER_CASH', userId, name: 'Player cash' } });
    const bonus = await tx.ledgerAccount.create({ data: { type: 'PLAYER_BONUS', userId, name: 'Player bonus' } });
    await tx.wallet.create({ data: { userId, cashAccountId: cash.id, bonusAccountId: bonus.id } });
    return this.applyMovement(tx, {
      userId,
      type: 'INITIAL_FUNDING',
      description: 'Welcome demo credits',
      idempotencyKey: `initial:${userId}`,
      cashDeltaMinor: creditsToMinor(initialCredits),
      bonusDeltaMinor: 0n,
      houseAccount: 'HOUSE_FUNDING',
    });
  }

  /**
   * Debits a stake, consuming cash first and bonus funds second. Returns the split so the round
   * can route a proportional share of any payout back to the bonus balance.
   */
  async debitStake(tx: Tx, input: { userId: string; stakeMinor: bigint; roundId: string; description: string }, locked?: LockedWallet) {
    const w = locked ?? (await this.lockWallet(tx, input.userId));
    const cashPart = input.stakeMinor <= w.balanceMinor ? input.stakeMinor : w.balanceMinor;
    const bonusPart = input.stakeMinor - cashPart;
    if (bonusPart > w.bonusBalanceMinor) throw Errors.insufficientBalance(input.stakeMinor, w.balanceMinor + w.bonusBalanceMinor);
    const result = await this.applyMovement(
      tx,
      {
        userId: input.userId,
        type: 'STAKE',
        description: input.description,
        idempotencyKey: `stake:${input.roundId}`,
        referenceType: 'game_round',
        referenceId: input.roundId,
        cashDeltaMinor: -cashPart,
        bonusDeltaMinor: -bonusPart,
        houseAccount: 'HOUSE_GAMING',
      },
      w,
    );
    return { ...result, cashPart, bonusPart };
  }

  async creditPayout(tx: Tx, input: { userId: string; payoutMinor: bigint; bonusPartMinor: bigint; roundId: string; description: string }, locked?: LockedWallet) {
    if (input.payoutMinor <= 0n) return null;
    return this.applyMovement(
      tx,
      {
        userId: input.userId,
        type: 'PAYOUT',
        description: input.description,
        idempotencyKey: `payout:${input.roundId}`,
        referenceType: 'game_round',
        referenceId: input.roundId,
        cashDeltaMinor: input.payoutMinor - input.bonusPartMinor,
        bonusDeltaMinor: input.bonusPartMinor,
        houseAccount: 'HOUSE_GAMING',
      },
      locked,
    );
  }

  async getWallet(userId: string): Promise<WalletDto> {
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return this.toDto(w);
  }

  toDto(w: { id: string; currency: string; balanceMinor: bigint; bonusBalanceMinor: bigint; version: number; updatedAt?: Date }): WalletDto {
    return {
      id: w.id,
      currency: w.currency,
      balanceMinor: Number(w.balanceMinor),
      bonusBalanceMinor: Number(w.bonusBalanceMinor),
      version: w.version,
      updatedAt: (w.updatedAt ?? new Date()).toISOString(),
    };
  }

  async getSummary(userId: string): Promise<WalletSummaryDto> {
    const dayStart = startOfUtcDay();
    const [wallet, today, lifetime, topup] = await Promise.all([
      this.prisma.wallet.findUniqueOrThrow({ where: { userId } }),
      this.prisma.gameRound.aggregate({ where: { userId, createdAt: { gte: dayStart }, status: 'SETTLED' }, _sum: { stakeMinor: true, payoutMinor: true } }),
      this.prisma.gameRound.aggregate({ where: { userId, status: 'SETTLED' }, _sum: { stakeMinor: true, payoutMinor: true }, _count: { _all: true } }),
      this.todayTopupMinor(this.prisma, userId),
    ]);
    return {
      wallet: this.toDto(wallet),
      todayStakedMinor: Number(today._sum.stakeMinor ?? 0n),
      todayPayoutMinor: Number(today._sum.payoutMinor ?? 0n),
      todayTopupMinor: Number(topup),
      lifetimeStakedMinor: Number(lifetime._sum.stakeMinor ?? 0n),
      lifetimePayoutMinor: Number(lifetime._sum.payoutMinor ?? 0n),
      roundsPlayed: lifetime._count._all,
    };
  }

  /** Positive cash top-ups today (demo resets + daily rewards) – used by the daily top-up limit. */
  async todayTopupMinor(db: Tx | PrismaService, userId: string): Promise<bigint> {
    const wallet = await db.wallet.findUniqueOrThrow({ where: { userId }, select: { cashAccountId: true, bonusAccountId: true } });
    const agg = await db.journalLine.aggregate({
      where: {
        accountId: { in: [wallet.cashAccountId, wallet.bonusAccountId] },
        amountMinor: { gt: 0n },
        createdAt: { gte: startOfUtcDay() },
        entry: { OR: [{ type: { in: TOPUP_TYPES } }, { type: 'BONUS_AWARD', metadata: { path: ['countsAsTopup'], equals: true } }] },
      },
      _sum: { amountMinor: true },
    });
    return agg._sum.amountMinor ?? 0n;
  }

  /** Development/demo only: restores the initial balance and forfeits active bonus funds. */
  async resetDemo(principal: AuthPrincipal, idempotencyKey?: string) {
    if (!this.config.get('ENABLE_DEMO_RESET')) throw Errors.forbidden('Demo reset is disabled');
    const key = idempotencyKey ?? randomUUID();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: principal.id } });
      if (user.status === 'SUSPENDED' || user.status === 'CLOSED') throw Errors.accountRestricted(user.status, null);
      const w = await this.lockWallet(tx, principal.id);
      const cashDelta = this.initialCreditsMinor - w.balanceMinor;
      await this.enforceTopupLimit(tx, principal.id, cashDelta > 0n ? cashDelta : 0n);
      await tx.playerBonus.updateMany({ where: { userId: principal.id, status: 'ACTIVE' }, data: { status: 'FORFEITED' } });
      const r = await this.applyMovement(
        tx,
        {
          userId: principal.id,
          type: 'DEMO_RESET',
          description: 'Demo balance reset',
          idempotencyKey: `reset:${principal.id}:${key}`,
          cashDeltaMinor: cashDelta,
          bonusDeltaMinor: -w.bonusBalanceMinor,
          houseAccount: 'HOUSE_FUNDING',
          createdById: principal.id,
        },
        w,
      );
      await this.audit.log(tx, { actorId: principal.id, actorRole: principal.role, action: 'wallet.demo_reset', targetType: 'wallet', targetId: w.id, metadata: { cashDeltaMinor: Number(cashDelta) } });
      return r;
    }, FINANCIAL_TX);
    this.publishWallet(result.wallet, 'demo_reset');
    return this.getWallet(principal.id);
  }

  async enforceTopupLimit(tx: Tx, userId: string, amountMinor: bigint) {
    if (amountMinor <= 0n) return;
    const limit = await tx.playerLimit.findUnique({ where: { userId_type: { userId, type: 'DAILY_TOPUP' } } });
    const setting = await tx.systemSetting.findUnique({ where: { key: 'dailyTopupLimitMinor' } });
    const caps = [limit?.value, setting ? BigInt(setting.value as number) : undefined].filter((v): v is bigint => typeof v === 'bigint');
    if (caps.length === 0) return;
    const used = await this.todayTopupMinor(tx, userId);
    for (const cap of caps) if (used + amountMinor > cap) throw Errors.limitExceeded('DAILY_TOPUP', cap, used);
  }

  /** Staff adjustment (signed). Produces an ADJUSTMENT entry + audit record; never edits history. */
  async adminAdjust(actor: AuthPrincipal, userId: string, amountMinor: bigint, reason: string) {
    if (amountMinor === 0n) throw Errors.badRequest('NO_CHANGE', 'Adjustment amount must be non-zero');
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.applyMovement(tx, {
        userId,
        type: 'ADJUSTMENT',
        description: `Manual adjustment: ${reason}`,
        idempotencyKey: `adjust:${randomUUID()}`,
        cashDeltaMinor: amountMinor,
        bonusDeltaMinor: 0n,
        houseAccount: 'HOUSE_FUNDING',
        createdById: actor.id,
        metadata: { reason },
      });
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: 'wallet.adjust', targetType: 'user', targetId: userId, metadata: { amountMinor: Number(amountMinor), reason, entryId: r.entry?.id } });
      return r;
    });
    this.publishWallet(result.wallet, 'adjustment');
    return result;
  }

  /** Reverses an ADJUSTMENT or BONUS_AWARD by posting a compensating entry. */
  async reverseEntry(actor: AuthPrincipal, entryId: string, reason: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: { lines: { include: { account: true } }, reversedBy: true } });
      if (entry.reversedBy || entry.type === 'REVERSAL') throw Errors.conflict('ALREADY_REVERSED', 'Entry already reversed');
      if (!['ADJUSTMENT', 'BONUS_AWARD', 'LOYALTY_REWARD'].includes(entry.type)) throw Errors.badRequest('NOT_REVERSIBLE', `Entries of type ${entry.type} cannot be reversed`);
      const playerLine = entry.lines.find((l) => l.account.userId);
      if (!playerLine?.account.userId) throw Errors.badRequest('NOT_REVERSIBLE', 'No player account on entry');
      const userId = playerLine.account.userId;
      const cashDelta = entry.lines.filter((l) => l.account.type === 'PLAYER_CASH').reduce((a, l) => a + l.amountMinor, 0n);
      const bonusDelta = entry.lines.filter((l) => l.account.type === 'PLAYER_BONUS').reduce((a, l) => a + l.amountMinor, 0n);
      const houseLine = entry.lines.find((l) => !l.account.userId);
      const r = await this.applyMovement(tx, {
        userId,
        type: 'REVERSAL',
        description: `Reversal of ${entry.type.toLowerCase()}: ${reason}`,
        idempotencyKey: `reversal:${entry.id}`,
        reversalOfId: entry.id,
        cashDeltaMinor: -cashDelta,
        bonusDeltaMinor: -bonusDelta,
        houseAccount: (houseLine?.account.type as LedgerAccountType) ?? 'HOUSE_FUNDING',
        createdById: actor.id,
        metadata: { reason, reversedEntryId: entry.id },
      });
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: 'ledger.reverse', targetType: 'journal_entry', targetId: entry.id, metadata: { reason, reversalEntryId: r.entry?.id } });
      return r;
    });
    this.publishWallet(result.wallet, 'reversal');
    return result;
  }

  publishWallet(w: LockedWallet, reason: string) {
    this.events.publish('wallet.updated', { userId: w.userId, balanceMinor: w.balanceMinor, bonusBalanceMinor: w.bonusBalanceMinor, version: w.version, reason });
  }

  async findForAdmin(userId: string) {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }

  static isPrismaUnique(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }
}
