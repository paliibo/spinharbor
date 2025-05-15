import { Injectable, OnModuleInit } from '@nestjs/common';
import type { RiskSeverity } from '@spinharbor/database';
import { AuditService } from '../audit/audit.service';
import { AuthPrincipal } from '../common/decorators/auth.decorators';
import { DomainEvents } from '../common/events/domain-events';
import { PrismaService } from '../common/prisma/prisma.service';
import { creditsToMinor } from '../common/money/money';

const HIGH_STAKE_MINOR = creditsToMinor(500);
const BIG_WIN_MINOR = creditsToMinor(5_000);
const DAILY_LOSS_FLAG_MINOR = creditsToMinor(5_000);

/** Simple behavioural heuristics producing review flags for operators. */
@Injectable()
export class RiskService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.events.subscribe('round.settled', (e) => this.evaluateRound(e));
  }

  async flag(userId: string, code: string, severity: RiskSeverity, description: string, metadata?: Record<string, unknown>) {
    // One open flag per (user, code) – avoids spamming operators with duplicates.
    const open = await this.prisma.riskFlag.findFirst({ where: { userId, code, status: 'OPEN' } });
    if (open) return open;
    const flag = await this.prisma.riskFlag.create({ data: { userId, code, severity, description, metadata: metadata as any } });
    this.events.publish('risk.flagged', { userId, code, severity });
    return flag;
  }

  private async evaluateRound(e: { userId: string; stakeMinor: bigint; payoutMinor: bigint; roundId: string }) {
    if (e.stakeMinor >= HIGH_STAKE_MINOR) await this.flag(e.userId, 'HIGH_STAKE', 'LOW', `Single stake of ${Number(e.stakeMinor) / 100} credits`, { roundId: e.roundId, stakeMinor: Number(e.stakeMinor) });
    if (e.payoutMinor >= BIG_WIN_MINOR) await this.flag(e.userId, 'BIG_WIN', 'MEDIUM', `Payout of ${Number(e.payoutMinor) / 100} credits on one round`, { roundId: e.roundId, payoutMinor: Number(e.payoutMinor) });
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const agg = await this.prisma.gameRound.aggregate({ where: { userId: e.userId, createdAt: { gte: since } }, _sum: { stakeMinor: true, payoutMinor: true }, _count: { _all: true } });
    const loss = (agg._sum.stakeMinor ?? 0n) - (agg._sum.payoutMinor ?? 0n);
    if (loss >= DAILY_LOSS_FLAG_MINOR) await this.flag(e.userId, 'HEAVY_LOSS_24H', 'HIGH', `Net loss of ${Number(loss) / 100} credits in 24h`, { lossMinor: Number(loss) });
    if (agg._count._all >= 300) await this.flag(e.userId, 'HIGH_VELOCITY', 'MEDIUM', `${agg._count._all} rounds in 24h`, { rounds: agg._count._all });
  }

  async review(actor: AuthPrincipal, flagId: string, status: 'REVIEWED' | 'DISMISSED', resolution: string) {
    return this.prisma.$transaction(async (tx) => {
      const flag = await tx.riskFlag.update({ where: { id: flagId }, data: { status, resolution, reviewedById: actor.id, reviewedAt: new Date() } });
      await this.audit.log(tx, { actorId: actor.id, actorRole: actor.role, action: 'risk.review', targetType: 'risk_flag', targetId: flagId, metadata: { status, resolution, userId: flag.userId } });
      return flag;
    });
  }
}
