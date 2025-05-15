import { z } from 'zod';
import type { LoyaltyTier } from './common';

export const BonusTypes = ['WELCOME', 'DAILY_REWARD', 'CASHBACK', 'LOYALTY_MILESTONE'] as const;
export type BonusType = (typeof BonusTypes)[number];

export interface BonusDefinitionDto {
  id: string;
  code: string;
  type: BonusType;
  name: string;
  description: string;
  amountMinor: number;
  percentBp: number | null;
  maxAmountMinor: number | null;
  wageringMultiplier: number;
  claimCooldownHours: number | null;
  maxClaimsPerUser: number | null;
  validForHours: number;
  requiredTier: LoyaltyTier | null;
  isActive: boolean;
}

export interface BonusEligibilityDto {
  definition: BonusDefinitionDto;
  eligible: boolean;
  reason: string | null;
  nextClaimAt: string | null;
  /** For cashback: computed award if claimed now. */
  previewAmountMinor: number | null;
}

export interface PlayerBonusDto {
  id: string;
  definition: Pick<BonusDefinitionDto, 'code' | 'name' | 'type'>;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'FORFEITED';
  amountMinor: number;
  wageringRequiredMinor: number;
  wageringProgressMinor: number;
  claimedAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export const ClaimBonusSchema = z.object({ code: z.string().min(1).max(64) });

export interface PromotionDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  artwork: { palette: [string, string, string]; motif: string };
  ctaLabel: string;
  bonusCode: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

export interface LoyaltyTierDef {
  tier: LoyaltyTier;
  minLifetimePoints: number;
  perks: string[];
  milestoneBonusCode: string | null;
}

export interface LoyaltyStatusDto {
  tier: LoyaltyTier;
  points: number;
  lifetimePoints: number;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  progressPercent: number;
  pointsPerCreditWagered: number;
  tiers: LoyaltyTierDef[];
  recent: { id: string; points: number; reason: string; createdAt: string }[];
}

export const PlayerLimitTypes = ['DAILY_WAGER', 'WEEKLY_WAGER', 'DAILY_LOSS', 'DAILY_TOPUP', 'SESSION_MINUTES'] as const;
export type PlayerLimitType = (typeof PlayerLimitTypes)[number];

export const SetLimitSchema = z.object({
  type: z.enum(PlayerLimitTypes),
  /** Minor units for money limits, minutes for SESSION_MINUTES. null removes the limit. */
  value: z.number().int().positive().nullable(),
});
export type SetLimitInput = z.infer<typeof SetLimitSchema>;

export const CoolingOffSchema = z.object({ hours: z.union([z.literal(24), z.literal(72), z.literal(168)]) });
export const SelfExcludeSchema = z.object({
  days: z.union([z.literal(30), z.literal(90), z.literal(180)]).nullable(),
  confirmation: z.literal('EXCLUDE ME'),
});

export interface ResponsibleGamingDto {
  status: string;
  statusUntil: string | null;
  limits: { type: PlayerLimitType; value: number; usedToday: number }[];
  sessionReminderMinutes: number;
}
