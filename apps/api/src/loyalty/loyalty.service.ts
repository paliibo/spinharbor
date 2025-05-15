import { Injectable } from '@nestjs/common';
import type { LoyaltyStatusDto, LoyaltyTierDef } from '@spinharbor/contracts';
import { LoyaltyTier, Prisma } from '@spinharbor/database';
import { PrismaService, Tx } from '../common/prisma/prisma.service';

/**
 * Loyalty formula: 1 point per 10 credits (1,000 minor units) wagered on any real round, floored
 * per round. Tiers are based on lifetime points. Points per round are awarded exactly once thanks
 * to the unique LoyaltyEvent.roundId.
 */
export const MINOR_PER_POINT = 1_000n;

export const LOYALTY_TIERS: LoyaltyTierDef[] = [
  { tier: 'BRONZE', minLifetimePoints: 0, perks: ['Daily reward access', 'Standard support'], milestoneBonusCode: null },
  { tier: 'SILVER', minLifetimePoints: 500, perks: ['Weekly cashback 5%', '250 credit milestone bonus'], milestoneBonusCode: 'MILESTONE_SILVER' },
  { tier: 'GOLD', minLifetimePoints: 2_500, perks: ['Weekly cashback 10%', '1,000 credit milestone bonus', 'Priority support'], milestoneBonusCode: 'MILESTONE_GOLD' },
  { tier: 'PLATINUM', minLifetimePoints: 10_000, perks: ['Weekly cashback 15%', '5,000 credit milestone bonus', 'Dedicated host (demo)'], milestoneBonusCode: 'MILESTONE_PLATINUM' },
];

export function tierForPoints(lifetime: bigint): LoyaltyTier {
  let tier: LoyaltyTier = 'BRONZE';
  for (const t of LOYALTY_TIERS) if (lifetime >= BigInt(t.minLifetimePoints)) tier = t.tier;
  return tier;
}

export const TIER_RANK: Record<LoyaltyTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 };

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: a second call for the same round is a no-op returning 0. */
  async awardForRound(tx: Tx, userId: string, roundId: string, stakeMinor: bigint): Promise<{ points: number; tierUpgradedTo: LoyaltyTier | null }> {
    const points = Number(stakeMinor / MINOR_PER_POINT);
    if (points <= 0) return { points: 0, tierUpgradedTo: null };
    try {
      await tx.loyaltyEvent.create({ data: { userId, roundId, points, reason: 'Wager' } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { points: 0, tierUpgradedTo: null };
      throw e;
    }
    const acc = await tx.loyaltyAccount.upsert({
      where: { userId },
      create: { userId, points: BigInt(points), lifetimePoints: BigInt(points) },
      update: { points: { increment: points }, lifetimePoints: { increment: points } },
    });
    const newTier = tierForPoints(acc.lifetimePoints);
    let tierUpgradedTo: LoyaltyTier | null = null;
    if (TIER_RANK[newTier] > TIER_RANK[acc.tier]) {
      await tx.loyaltyAccount.update({ where: { userId }, data: { tier: newTier, tierUpdatedAt: new Date() } });
      await tx.notification.create({ data: { userId, type: 'loyalty.tier', title: `Welcome to ${newTier.charAt(0) + newTier.slice(1).toLowerCase()}!`, body: 'Your loyalty tier was upgraded. Check the Loyalty page for your milestone reward.' } });
      tierUpgradedTo = newTier;
    }
    return { points, tierUpgradedTo };
  }

  async status(userId: string): Promise<LoyaltyStatusDto> {
    const [acc, recent] = await Promise.all([
      this.prisma.loyaltyAccount.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.prisma.loyaltyEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const idx = LOYALTY_TIERS.findIndex((t) => t.tier === acc.tier);
    const next = LOYALTY_TIERS[idx + 1] ?? null;
    const current = LOYALTY_TIERS[idx];
    const lifetime = Number(acc.lifetimePoints);
    const span = next ? next.minLifetimePoints - current.minLifetimePoints : 1;
    const progress = next ? Math.min(100, Math.round(((lifetime - current.minLifetimePoints) / span) * 100)) : 100;
    return {
      tier: acc.tier,
      points: Number(acc.points),
      lifetimePoints: lifetime,
      nextTier: next?.tier ?? null,
      pointsToNextTier: next ? Math.max(0, next.minLifetimePoints - lifetime) : 0,
      progressPercent: progress,
      pointsPerCreditWagered: 0.1,
      tiers: LOYALTY_TIERS,
      recent: recent.map((e) => ({ id: e.id, points: e.points, reason: e.reason, createdAt: e.createdAt.toISOString() })),
    };
  }
}
