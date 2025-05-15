import { z } from 'zod';

export interface WalletDto {
  id: string;
  currency: string;
  balanceMinor: number;
  bonusBalanceMinor: number;
  version: number;
  updatedAt: string;
}

export const JournalEntryTypes = [
  'INITIAL_FUNDING',
  'STAKE',
  'PAYOUT',
  'REFUND',
  'BONUS_AWARD',
  'BONUS_RELEASE',
  'BONUS_FORFEIT',
  'LOYALTY_REWARD',
  'ADJUSTMENT',
  'DEMO_RESET',
  'REVERSAL',
] as const;
export type JournalEntryType = (typeof JournalEntryTypes)[number];

export interface TransactionDto {
  id: string;
  entryId: string;
  type: JournalEntryType;
  description: string;
  amountMinor: number;
  balanceAfterMinor: number | null;
  account: 'CASH' | 'BONUS';
  referenceType: string | null;
  referenceId: string | null;
  gameName?: string | null;
  createdAt: string;
}

export const TransactionListQuerySchema = z.object({
  type: z.enum(JournalEntryTypes).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>;

export interface WalletSummaryDto {
  wallet: WalletDto;
  todayStakedMinor: number;
  todayPayoutMinor: number;
  todayTopupMinor: number;
  lifetimeStakedMinor: number;
  lifetimePayoutMinor: number;
  roundsPlayed: number;
}
