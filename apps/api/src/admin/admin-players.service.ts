import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@spinharbor/database';
import { z } from 'zod';
import type { AdminPlayerQuerySchema } from '@spinharbor/contracts';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal, ROLE_RANK } from '../common/decorators/auth.decorators';
import { Errors } from '../common/errors/domain.errors';
import { DomainEvents } from '../common/events/domain-events';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate, skipTake } from '../common/utils/pagination';
import { LedgerService } from '../ledger/ledger.service';
import { LimitsService } from '../risk/limits.service';

type PlayerQuery = z.infer<typeof AdminPlayerQuerySchema>;

@Injectable()
export class AdminPlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: DomainEvents,
    private readonly ledger: LedgerService,
    private readonly limits: LimitsService,
  ) {}

  async list(q: PlayerQuery) {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.search ? { OR: [{ username: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }, { id: q.search }, { profile: { displayName: { contains: q.search, mode: 'insensitive' } } }] } : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput = q.sort === 'oldest' ? { createdAt: 'asc' } : q.sort === 'balance' ? { wallet: { balanceMinor: 'desc' } } : q.sort === 'activity' ? { lastLoginAt: 'desc' } : { createdAt: 'desc' };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, orderBy, ...skipTake(q.page, q.pageSize), include: { profile: true, wallet: true, loyalty: true, _count: { select: { riskFlags: { where: { status: 'OPEN' } }, rounds: true } } } }),
    ]);
    return paginate(
      rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.profile?.displayName ?? u.username,
        role: u.role,
        status: u.status,
        statusUntil: u.statusUntil?.toISOString() ?? null,
        balanceMinor: Number(u.wallet?.balanceMinor ?? 0n),
        bonusBalanceMinor: Number(u.wallet?.bonusBalanceMinor ?? 0n),
        tier: u.loyalty?.tier ?? 'BRONZE',
        openRiskFlags: u._count.riskFlags,
        rounds: u._count.rounds,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      q.page,
      q.pageSize,
    );
  }

  async detail(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { profile: true, wallet: true, loyalty: true, limits: true, riskFlags: { orderBy: { createdAt: 'desc' }, take: 20, include: { reviewedBy: { select: { username: true } } } }, bonuses: { include: { definition: true }, orderBy: { claimedAt: 'desc' }, take: 20 } } });
    if (!u) throw Errors.notFound('Player');
    const [agg, sessions, reconcile, limitUsage, recentAudit] = await Promise.all([
      this.prisma.gameRound.aggregate({ where: { userId: id, status: 'SETTLED' }, _sum: { stakeMinor: true, payoutMinor: true }, _count: { _all: true }, _max: { createdAt: true } }),
      this.prisma.gameSession.count({ where: { userId: id, status: 'ACTIVE' } }),
      u.wallet ? this.ledger.reconcileUser(id) : null,
      this.limits.usage(id),
      this.prisma.auditLog.findMany({ where: { OR: [{ targetType: 'user', targetId: id }, { actorId: id }] }, orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { username: true } } } }),
    ]);
    const staked = agg._sum.stakeMinor ?? 0n;
    const paid = agg._sum.payoutMinor ?? 0n;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      statusReason: u.statusReason,
      statusUntil: u.statusUntil?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      profile: u.profile,
      wallet: u.wallet ? { balanceMinor: Number(u.wallet.balanceMinor), bonusBalanceMinor: Number(u.wallet.bonusBalanceMinor), version: u.wallet.version, reconciled: reconcile?.ok ?? null } : null,
      loyalty: u.loyalty ? { tier: u.loyalty.tier, points: Number(u.loyalty.points), lifetimePoints: Number(u.loyalty.lifetimePoints) } : null,
      stats: { rounds: agg._count._all, stakedMinor: Number(staked), payoutMinor: Number(paid), ggrMinor: Number(staked - paid), lastRoundAt: agg._max.createdAt?.toISOString() ?? null, activeSessions: sessions },
      limits: limitUsage,
      riskFlags: u.riskFlags.map((f) => ({ ...f, reviewedBy: f.reviewedBy?.username ?? null })),
      bonuses: u.bonuses.map((b) => ({ id: b.id, name: b.definition.name, code: b.definition.code, status: b.status, amountMinor: Number(b.amountMinor), wageringRequiredMinor: Number(b.wageringRequiredMinor), wageringProgressMinor: Number(b.wageringProgressMinor), claimedAt: b.claimedAt.toISOString(), expiresAt: b.expiresAt.toISOString() })),
      audit: recentAudit.map((a) => ({ id: a.id, action: a.action, actor: a.actor?.username ?? 'system', targetType: a.targetType, targetId: a.targetId, metadata: a.metadata, createdAt: a.createdAt.toISOString() })),
    };
  }

  /** Suspend / reactivate / close. Staff cannot change accounts with an equal or higher role. */
  async updateStatus(actor: AuthPrincipal, id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED', reason: string, ip?: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw Errors.notFound('Player');
    if (target.id === actor.id) throw Errors.forbidden('You cannot change your own account status');
    if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) throw Errors.forbidden('Insufficient role to modify this account');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status, statusReason: reason, statusUntil: null } });
      if (status !== 'ACTIVE') {
        await tx.gameSession.updateMany({ where: { userId: id, status: 'ACTIVE' }, data: { status: 'CLOSED', closedAt: new Date() } });
        await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: `player.status.${status.toLowerCase()}`, targetType: 'user', targetId: id, metadata: { reason, previous: target.status }, ip });
    });
    this.events.publish('account.status', { userId: id, status, statusUntil: null, reason });
    return this.detail(id);
  }

  async sessions(q: { userId?: string; status?: 'ACTIVE' | 'CLOSED' | 'EXPIRED'; page: number; pageSize: number }) {
    const where: Prisma.GameSessionWhereInput = { ...(q.userId ? { userId: q.userId } : {}), ...(q.status ? { status: q.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.findMany({ where, orderBy: { startedAt: 'desc' }, ...skipTake(q.page, q.pageSize), include: { user: { select: { username: true } }, game: { select: { name: true, slug: true, engine: true } }, provider: { select: { name: true } } } }),
    ]);
    return paginate(
      rows.map((s) => ({ id: s.id, userId: s.userId, username: s.user.username, game: s.game, provider: s.provider.name, status: s.status, startedAt: s.startedAt.toISOString(), lastActivityAt: s.lastActivityAt.toISOString(), closedAt: s.closedAt?.toISOString() ?? null, roundsCount: s.roundsCount, totalStakedMinor: Number(s.totalStakedMinor), totalPaidMinor: Number(s.totalPaidMinor) })),
      total,
      q.page,
      q.pageSize,
    );
  }

  async rounds(q: { userId?: string; gameSlug?: string; engine?: string; status?: string; page: number; pageSize: number }) {
    const where: Prisma.GameRoundWhereInput = { ...(q.userId ? { userId: q.userId } : {}), ...(q.gameSlug ? { game: { slug: q.gameSlug } } : {}), ...(q.engine ? { engine: q.engine as any } : {}), ...(q.status ? { status: q.status as any } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.gameRound.count({ where }),
      this.prisma.gameRound.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize), include: { user: { select: { username: true } }, game: { select: { name: true, slug: true } }, transactions: { select: { id: true, type: true, amountMinor: true, journalEntryId: true } } } }),
    ]);
    return paginate(
      rows.map((r) => ({ id: r.id, sessionId: r.sessionId, userId: r.userId, username: r.user.username, game: r.game, engine: r.engine, status: r.status, stakeMinor: Number(r.stakeMinor), payoutMinor: Number(r.payoutMinor), bonusStakeMinor: Number(r.bonusStakeMinor), input: r.input, result: r.result, rngSeedHash: r.rngSeedHash, createdAt: r.createdAt.toISOString(), settledAt: r.settledAt?.toISOString() ?? null, transactions: r.transactions.map((t) => ({ ...t, amountMinor: Number(t.amountMinor) })) })),
      total,
      q.page,
      q.pageSize,
    );
  }

  async transactions(q: { userId?: string; type?: string; referenceId?: string; page: number; pageSize: number }) {
    const where: Prisma.JournalEntryWhereInput = {
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.referenceId ? { referenceId: q.referenceId } : {}),
      ...(q.userId ? { lines: { some: { account: { userId: q.userId } } } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize), include: { lines: { include: { account: { include: { user: { select: { username: true, id: true } } } } } }, reversedBy: { select: { id: true } } } }),
    ]);
    const gameNames = await this.ledger.gameNamesForRefs(rows);
    return paginate(
      rows.map((e) => {
        const player = e.lines.find((l) => l.account.userId);
        return {
          id: e.id,
          type: e.type,
          description: e.description,
          referenceType: e.referenceType,
          referenceId: e.referenceId,
          gameName: e.referenceType === 'game_round' && e.referenceId ? (gameNames.get(e.referenceId) ?? null) : null,
          userId: player?.account.userId ?? null,
          username: player?.account.user?.username ?? null,
          reversedById: e.reversedBy?.id ?? null,
          reversalOfId: e.reversalOfId,
          createdById: e.createdById,
          metadata: e.metadata,
          createdAt: e.createdAt.toISOString(),
          lines: e.lines.map((l) => ({ id: l.id, account: l.account.type, accountName: l.account.name, amountMinor: Number(l.amountMinor), balanceAfterMinor: l.balanceAfterMinor === null ? null : Number(l.balanceAfterMinor) })),
        };
      }),
      total,
      q.page,
      q.pageSize,
    );
  }

  async transaction(id: string) {
    const page = await this.transactions({ referenceId: undefined, page: 1, pageSize: 1, userId: undefined, type: undefined });
    void page;
    const e = await this.prisma.journalEntry.findUnique({ where: { id }, include: { lines: { include: { account: { include: { user: { select: { username: true, id: true } } } } } }, reversedBy: { select: { id: true } }, roundTransaction: { include: { round: { include: { game: { select: { name: true, slug: true } } } } } } } });
    if (!e) throw Errors.notFound('Transaction');
    return {
      id: e.id,
      type: e.type,
      description: e.description,
      idempotencyKey: e.idempotencyKey,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      reversalOfId: e.reversalOfId,
      reversedById: e.reversedBy?.id ?? null,
      createdById: e.createdById,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
      lines: e.lines.map((l) => ({ id: l.id, accountId: l.accountId, account: l.account.type, accountName: l.account.name, userId: l.account.userId, username: l.account.user?.username ?? null, amountMinor: Number(l.amountMinor), balanceAfterMinor: l.balanceAfterMinor === null ? null : Number(l.balanceAfterMinor) })),
      round: e.roundTransaction ? { id: e.roundTransaction.round.id, game: e.roundTransaction.round.game, stakeMinor: Number(e.roundTransaction.round.stakeMinor), payoutMinor: Number(e.roundTransaction.round.payoutMinor), status: e.roundTransaction.round.status, result: e.roundTransaction.round.result } : null,
    };
  }

  async userStatuses(): Promise<UserStatus[]> {
    return ['ACTIVE', 'SUSPENDED', 'COOLING_OFF', 'SELF_EXCLUDED', 'CLOSED'];
  }
}
