import { Injectable } from '@nestjs/common';
import type { PlayerLimitType } from '@spinharbor/database';
import { Errors } from '../common/errors/domain.errors';
import { startOfUtcDay, startOfUtcWeek } from '../common/money/money';
import { PrismaService, Tx } from '../common/prisma/prisma.service';

/** Player-configured limits are enforced here, inside the gameplay transaction. */
@Injectable()
export class LimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWagerAllowed(tx: Tx, userId: string, stakeMinor: bigint, session: { startedAt: Date; id: string }) {
    const limits = await tx.playerLimit.findMany({ where: { userId } });
    if (limits.length === 0) return;
    const byType = new Map(limits.map((l) => [l.type, l.value]));
    const now = new Date();

    const sessionMinutes = byType.get('SESSION_MINUTES');
    if (sessionMinutes !== undefined && now.getTime() - session.startedAt.getTime() > Number(sessionMinutes) * 60_000) {
      await tx.gameSession.update({ where: { id: session.id }, data: { status: 'EXPIRED', closedAt: now } });
      throw Errors.limitExceeded('SESSION_MINUTES', sessionMinutes, BigInt(Math.floor((now.getTime() - session.startedAt.getTime()) / 60_000)));
    }

    const needDay = byType.has('DAILY_WAGER') || byType.has('DAILY_LOSS');
    const needWeek = byType.has('WEEKLY_WAGER');
    const [day, week] = await Promise.all([
      needDay ? tx.gameRound.aggregate({ where: { userId, createdAt: { gte: startOfUtcDay(now) }, status: { not: 'VOIDED' } }, _sum: { stakeMinor: true, payoutMinor: true } }) : null,
      needWeek ? tx.gameRound.aggregate({ where: { userId, createdAt: { gte: startOfUtcWeek(now) }, status: { not: 'VOIDED' } }, _sum: { stakeMinor: true } }) : null,
    ]);
    const dayStake = day?._sum.stakeMinor ?? 0n;
    const dayPayout = day?._sum.payoutMinor ?? 0n;

    const dailyWager = byType.get('DAILY_WAGER');
    if (dailyWager !== undefined && dayStake + stakeMinor > dailyWager) throw Errors.limitExceeded('DAILY_WAGER', dailyWager, dayStake);
    const weeklyWager = byType.get('WEEKLY_WAGER');
    if (weeklyWager !== undefined && (week?._sum.stakeMinor ?? 0n) + stakeMinor > weeklyWager) throw Errors.limitExceeded('WEEKLY_WAGER', weeklyWager, week?._sum.stakeMinor ?? 0n);
    const dailyLoss = byType.get('DAILY_LOSS');
    if (dailyLoss !== undefined) {
      const netLoss = dayStake - dayPayout;
      // Conservative: the stake is counted as a potential loss before the outcome is known.
      if (netLoss + stakeMinor > dailyLoss) throw Errors.limitExceeded('DAILY_LOSS', dailyLoss, netLoss > 0n ? netLoss : 0n);
    }
  }

  async setLimit(userId: string, type: PlayerLimitType, value: bigint | null) {
    if (value === null) {
      await this.prisma.playerLimit.deleteMany({ where: { userId, type } });
      return null;
    }
    return this.prisma.playerLimit.upsert({ where: { userId_type: { userId, type } }, create: { userId, type, value }, update: { value } });
  }

  async usage(userId: string) {
    const now = new Date();
    const [limits, day, week, topup] = await Promise.all([
      this.prisma.playerLimit.findMany({ where: { userId } }),
      this.prisma.gameRound.aggregate({ where: { userId, createdAt: { gte: startOfUtcDay(now) } }, _sum: { stakeMinor: true, payoutMinor: true } }),
      this.prisma.gameRound.aggregate({ where: { userId, createdAt: { gte: startOfUtcWeek(now) } }, _sum: { stakeMinor: true } }),
      this.prisma.wallet.findUnique({ where: { userId }, select: { cashAccountId: true, bonusAccountId: true } }).then((w) =>
        w
          ? this.prisma.journalLine.aggregate({
              where: { accountId: { in: [w.cashAccountId, w.bonusAccountId] }, amountMinor: { gt: 0n }, createdAt: { gte: startOfUtcDay(now) }, entry: { type: { in: ['DEMO_RESET', 'BONUS_AWARD'] } } },
              _sum: { amountMinor: true },
            })
          : null,
      ),
    ]);
    const used: Record<PlayerLimitType, bigint> = {
      DAILY_WAGER: day._sum.stakeMinor ?? 0n,
      WEEKLY_WAGER: week._sum.stakeMinor ?? 0n,
      DAILY_LOSS: (day._sum.stakeMinor ?? 0n) - (day._sum.payoutMinor ?? 0n),
      DAILY_TOPUP: topup?._sum?.amountMinor ?? 0n,
      SESSION_MINUTES: 0n,
    };
    return limits.map((l) => ({ type: l.type, value: Number(l.value), usedToday: Number(used[l.type] < 0n ? 0n : used[l.type]) }));
  }
}
