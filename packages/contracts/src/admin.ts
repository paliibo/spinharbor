import { z } from 'zod';
import { GameStatuses, Volatilities } from './catalogue';
import { UserStatuses } from './common';

export const AdminPlayerQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  status: z.enum(UserStatuses).optional(),
  role: z.enum(['PLAYER', 'SUPPORT', 'OPERATOR', 'ADMIN']).optional(),
  sort: z.enum(['newest', 'oldest', 'balance', 'activity']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminUpdatePlayerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
  reason: z.string().min(3).max(300),
});

export const AdminUpdateGameSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  tagline: z.string().max(80).nullable().optional(),
  description: z.string().min(10).max(2000).optional(),
  status: z.enum(GameStatuses).optional(),
  volatility: z.enum(Volatilities).optional(),
  rtpLabel: z.string().max(12).nullable().optional(),
  minBetMinor: z.number().int().positive().optional(),
  maxBetMinor: z.number().int().positive().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  categorySlugs: z.array(z.string()).optional(),
});

export const AdminCategorySchema = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(40),
  description: z.string().max(200).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const AdminUpdateBonusSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().min(2).max(500).optional(),
  amountMinor: z.number().int().min(0).optional(),
  percentBp: z.number().int().min(0).max(10000).nullable().optional(),
  maxAmountMinor: z.number().int().positive().nullable().optional(),
  wageringMultiplier: z.number().int().min(0).max(100).optional(),
  claimCooldownHours: z.number().int().positive().nullable().optional(),
  maxClaimsPerUser: z.number().int().positive().nullable().optional(),
  validForHours: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const AdminUpdatePromotionSchema = z.object({
  title: z.string().min(2).max(80).optional(),
  subtitle: z.string().max(120).nullable().optional(),
  description: z.string().min(2).max(1000).optional(),
  ctaLabel: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

export const AdminProviderUpdateSchema = z.object({
  status: z.enum(['OPERATIONAL', 'DISABLED']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const AdminRiskReviewSchema = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED']),
  resolution: z.string().min(2).max(300),
});

export const AdminSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maxBetMinor: z.number().int().positive().optional(),
  crashHouseEdgeBp: z.number().int().min(0).max(2000).optional(),
  dailyTopupLimitMinor: z.number().int().positive().optional(),
  sessionReminderDefaultMinutes: z.number().int().min(0).max(240).optional(),
});

export const DateRangeQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
});

export const AdminRoundQuerySchema = z.object({
  userId: z.string().optional(),
  gameSlug: z.string().optional(),
  engine: z.enum(['SLOTS', 'DICE', 'ROULETTE', 'CRASH']).optional(),
  status: z.enum(['OPEN', 'SETTLED', 'VOIDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminTransactionQuerySchema = z.object({
  userId: z.string().optional(),
  type: z.string().optional(),
  referenceId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminSessionQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminAuditQuerySchema = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  targetType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export interface DashboardMetricsDto {
  range: string;
  totals: {
    players: number;
    activePlayers: number;
    newPlayers: number;
    totalStakedMinor: number;
    totalPayoutMinor: number;
    ggrMinor: number;
    rounds: number;
    activeSessions: number;
    bonusClaims: number;
    bonusAwardedMinor: number;
    openRiskFlags: number;
  };
  daily: { date: string; stakedMinor: number; payoutMinor: number; ggrMinor: number; rounds: number; players: number }[];
  topGames: { gameId: string; slug: string; name: string; rounds: number; stakedMinor: number; ggrMinor: number }[];
  engineSplit: { engine: string; rounds: number; stakedMinor: number }[];
  recentTransactions: {
    id: string;
    type: string;
    description: string;
    amountMinor: number;
    username: string;
    createdAt: string;
  }[];
  recentBonusClaims: { id: string; username: string; bonusName: string; amountMinor: number; claimedAt: string }[];
}
