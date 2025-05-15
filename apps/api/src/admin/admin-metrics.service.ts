import { Injectable } from '@nestjs/common';
import type { DashboardMetricsDto } from '@spinharbor/contracts';
import { Prisma } from '@spinharbor/database';
import { PrismaService } from '../common/prisma/prisma.service';

const RANGE_MS: Record<string, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000, '90d': 90 * 86_400_000 };

interface DailyRow {
  day: Date;
  staked: bigint;
  payout: bigint;
  rounds: bigint;
  players: bigint;
}

/** All dashboard numbers are aggregated from persisted rounds, journal entries and claims. */
@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(range: string): Promise<DashboardMetricsDto> {
    const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS['7d']));
    const roundWhere: Prisma.GameRoundWhereInput = { createdAt: { gte: since }, status: 'SETTLED' };
    const [players, newPlayers, activePlayers, totals, activeSessions, bonusClaims, bonusAwarded, openFlags, daily, topGames, engineSplit, recentTx, recentClaims] = await Promise.all([
      this.prisma.user.count({ where: { role: 'PLAYER' } }),
      this.prisma.user.count({ where: { role: 'PLAYER', createdAt: { gte: since } } }),
      this.prisma.gameRound.findMany({ where: roundWhere, distinct: ['userId'], select: { userId: true } }).then((r) => r.length),
      this.prisma.gameRound.aggregate({ where: roundWhere, _sum: { stakeMinor: true, payoutMinor: true }, _count: { _all: true } }),
      this.prisma.gameSession.count({ where: { status: 'ACTIVE', lastActivityAt: { gte: new Date(Date.now() - 3600_000) } } }),
      this.prisma.playerBonus.count({ where: { claimedAt: { gte: since } } }),
      this.prisma.playerBonus.aggregate({ where: { claimedAt: { gte: since } }, _sum: { amountMinor: true } }),
      this.prisma.riskFlag.count({ where: { status: 'OPEN' } }),
      this.prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               COALESCE(SUM("stakeMinor"), 0)::bigint AS staked,
               COALESCE(SUM("payoutMinor"), 0)::bigint AS payout,
               COUNT(*)::bigint AS rounds,
               COUNT(DISTINCT "userId")::bigint AS players
        FROM "GameRound" WHERE "createdAt" >= ${since} AND status = 'SETTLED'
        GROUP BY 1 ORDER BY 1`,
      this.prisma.gameRound.groupBy({ by: ['gameId'], where: roundWhere, _count: { _all: true }, _sum: { stakeMinor: true, payoutMinor: true }, orderBy: { _count: { gameId: 'desc' } }, take: 6 }),
      this.prisma.gameRound.groupBy({ by: ['engine'], where: roundWhere, _count: { _all: true }, _sum: { stakeMinor: true } }),
      this.prisma.journalEntry.findMany({ where: { type: { in: ['STAKE', 'PAYOUT', 'BONUS_AWARD', 'DEMO_RESET', 'ADJUSTMENT', 'REVERSAL', 'REFUND'] } }, orderBy: { createdAt: 'desc' }, take: 10, include: { lines: { include: { account: { include: { user: { select: { username: true } } } } } } } }),
      this.prisma.playerBonus.findMany({ orderBy: { claimedAt: 'desc' }, take: 8, include: { user: { select: { username: true } }, definition: { select: { name: true } } } }),
    ]);
    const gameIds = topGames.map((g) => g.gameId);
    const games = await this.prisma.casinoGame.findMany({ where: { id: { in: gameIds } }, select: { id: true, slug: true, name: true } });
    const gameMap = new Map(games.map((g) => [g.id, g]));
    const staked = totals._sum.stakeMinor ?? 0n;
    const payout = totals._sum.payoutMinor ?? 0n;
    return {
      range,
      totals: {
        players,
        activePlayers,
        newPlayers,
        totalStakedMinor: Number(staked),
        totalPayoutMinor: Number(payout),
        ggrMinor: Number(staked - payout),
        rounds: totals._count._all,
        activeSessions,
        bonusClaims,
        bonusAwardedMinor: Number(bonusAwarded._sum.amountMinor ?? 0n),
        openRiskFlags: openFlags,
      },
      daily: daily.map((d) => ({ date: d.day.toISOString().slice(0, 10), stakedMinor: Number(d.staked), payoutMinor: Number(d.payout), ggrMinor: Number(d.staked - d.payout), rounds: Number(d.rounds), players: Number(d.players) })),
      topGames: topGames.map((g) => ({ gameId: g.gameId, slug: gameMap.get(g.gameId)?.slug ?? '', name: gameMap.get(g.gameId)?.name ?? 'Unknown', rounds: g._count._all, stakedMinor: Number(g._sum.stakeMinor ?? 0n), ggrMinor: Number((g._sum.stakeMinor ?? 0n) - (g._sum.payoutMinor ?? 0n)) })),
      engineSplit: engineSplit.map((e) => ({ engine: e.engine, rounds: e._count._all, stakedMinor: Number(e._sum.stakeMinor ?? 0n) })),
      recentTransactions: recentTx.map((e) => {
        const playerLine = e.lines.find((l) => l.account.userId);
        return { id: e.id, type: e.type, description: e.description, amountMinor: Number(playerLine?.amountMinor ?? 0n), username: playerLine?.account.user?.username ?? '—', createdAt: e.createdAt.toISOString() };
      }),
      recentBonusClaims: recentClaims.map((c) => ({ id: c.id, username: c.user.username, bonusName: c.definition.name, amountMinor: Number(c.amountMinor), claimedAt: c.claimedAt.toISOString() })),
    };
  }
}
