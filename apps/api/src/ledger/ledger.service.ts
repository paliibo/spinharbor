import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Paginated, TransactionDto, TransactionListQuery } from '@spinharbor/contracts';
import { JournalEntryType, LedgerAccountType, Prisma } from '@spinharbor/database';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService, Tx } from '../common/prisma/prisma.service';
import { paginate, skipTake } from '../common/utils/pagination';

export interface LineInput {
  accountId: string;
  amountMinor: bigint;
  balanceAfterMinor?: bigint;
}

export interface PostEntryInput {
  type: JournalEntryType;
  description: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  reversalOfId?: string;
  createdById?: string | null;
  metadata?: Record<string, unknown>;
  lines: LineInput[];
}

export const HOUSE_ACCOUNTS: { type: LedgerAccountType; name: string }[] = [
  { type: 'HOUSE_FUNDING', name: 'House – demo credit funding' },
  { type: 'HOUSE_GAMING', name: 'House – gaming (stakes & payouts)' },
  { type: 'HOUSE_BONUS', name: 'House – bonus & loyalty pool' },
];

/**
 * Double-entry journal. Every entry's lines sum to zero; entries are never updated or deleted.
 * Corrections are expressed as new (reversal / adjustment) entries.
 */
@Injectable()
export class LedgerService implements OnModuleInit {
  private readonly houseIds = new Map<LedgerAccountType, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureHouseAccounts();
  }

  async ensureHouseAccounts() {
    for (const h of HOUSE_ACCOUNTS) {
      let acc = await this.prisma.ledgerAccount.findFirst({ where: { type: h.type, userId: null } });
      if (!acc) acc = await this.prisma.ledgerAccount.create({ data: { type: h.type, name: h.name } });
      this.houseIds.set(h.type, acc.id);
    }
  }

  houseAccountId(type: LedgerAccountType): string {
    const id = this.houseIds.get(type);
    if (!id) throw new Error(`House account ${type} not initialised`);
    return id;
  }

  async postEntry(tx: Tx, input: PostEntryInput) {
    const lines = input.lines.filter((l) => l.amountMinor !== 0n);
    if (lines.length < 2) throw Errors.badRequest('LEDGER_INVALID', 'A journal entry needs at least two non-zero lines');
    const sum = lines.reduce((a, l) => a + l.amountMinor, 0n);
    if (sum !== 0n) throw new Error(`Unbalanced journal entry (${sum}) for ${input.idempotencyKey}`);
    return tx.journalEntry.create({
      data: {
        type: input.type,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reversalOfId: input.reversalOfId,
        createdById: input.createdById ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        lines: { create: lines.map((l) => ({ accountId: l.accountId, amountMinor: l.amountMinor, balanceAfterMinor: l.balanceAfterMinor })) },
      },
      include: { lines: true },
    });
  }

  async accountBalance(db: Tx | PrismaService, accountId: string): Promise<bigint> {
    const agg = await db.journalLine.aggregate({ where: { accountId }, _sum: { amountMinor: true } });
    return agg._sum.amountMinor ?? 0n;
  }

  /** Verifies that the cached wallet balances equal the journal for a user. */
  async reconcileUser(userId: string) {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const [cash, bonus] = await Promise.all([this.accountBalance(this.prisma, wallet.cashAccountId), this.accountBalance(this.prisma, wallet.bonusAccountId)]);
    return {
      userId,
      walletCashMinor: wallet.balanceMinor,
      ledgerCashMinor: cash,
      walletBonusMinor: wallet.bonusBalanceMinor,
      ledgerBonusMinor: bonus,
      ok: wallet.balanceMinor === cash && wallet.bonusBalanceMinor === bonus,
    };
  }

  /** Global invariant: every entry balances, so the sum of all lines is zero. */
  async globalBalance(): Promise<bigint> {
    const agg = await this.prisma.journalLine.aggregate({ _sum: { amountMinor: true } });
    return agg._sum.amountMinor ?? 0n;
  }

  async listPlayerTransactions(userId: string, q: TransactionListQuery): Promise<Paginated<TransactionDto>> {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const where: Prisma.JournalLineWhereInput = {
      accountId: { in: [wallet.cashAccountId, wallet.bonusAccountId] },
      entry: {
        ...(q.type ? { type: q.type } : {}),
        ...(q.from || q.to ? { createdAt: { gte: q.from, lte: q.to } } : {}),
      },
    };
    const [total, lines] = await Promise.all([
      this.prisma.journalLine.count({ where }),
      this.prisma.journalLine.findMany({ where, include: { entry: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...skipTake(q.page, q.pageSize) }),
    ]);
    const gameNames = await this.gameNamesForRefs(lines.map((l) => l.entry));
    return paginate(
      lines.map((l) => ({
        id: l.id,
        entryId: l.entryId,
        type: l.entry.type,
        description: l.entry.description,
        amountMinor: Number(l.amountMinor),
        balanceAfterMinor: l.balanceAfterMinor === null ? null : Number(l.balanceAfterMinor),
        account: l.accountId === wallet.cashAccountId ? ('CASH' as const) : ('BONUS' as const),
        referenceType: l.entry.referenceType,
        referenceId: l.entry.referenceId,
        gameName: l.entry.referenceType === 'game_round' && l.entry.referenceId ? (gameNames.get(l.entry.referenceId) ?? null) : null,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      q.page,
      q.pageSize,
    );
  }

  /** Batch lookup to avoid N+1 when decorating transactions with game names. */
  async gameNamesForRefs(entries: { referenceType: string | null; referenceId: string | null }[]): Promise<Map<string, string>> {
    const ids = [...new Set(entries.filter((e) => e.referenceType === 'game_round' && e.referenceId).map((e) => e.referenceId as string))];
    if (ids.length === 0) return new Map();
    const rounds = await this.prisma.gameRound.findMany({ where: { id: { in: ids } }, select: { id: true, game: { select: { name: true } } } });
    return new Map(rounds.map((r) => [r.id, r.game.name]));
  }
}
