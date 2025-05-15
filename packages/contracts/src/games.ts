import { z } from 'zod';
import { IdempotencyKeySchema } from './common';
import type { GameEngine } from './catalogue';

// ───────────── Sessions ─────────────
export const CreateGameSessionSchema = z.object({ gameSlug: z.string().min(1).max(64) });
export type CreateGameSessionInput = z.infer<typeof CreateGameSessionSchema>;

export interface GameSessionDto {
  id: string;
  gameId: string;
  gameSlug: string;
  engine: GameEngine;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  startedAt: string;
  roundsCount: number;
  totalStakedMinor: number;
  totalPaidMinor: number;
  config: SlotsConfig | DiceConfig | RouletteConfig | CrashConfig | Record<string, never>;
}

// ───────────── Slots ─────────────
export const SLOT_SYMBOLS = ['ANCHOR', 'GEM', 'CROWN', 'BELL', 'SEVEN', 'CHERRY', 'LEMON', 'STAR'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export interface SlotsPaytableEntry {
  symbol: SlotSymbol;
  /** Multiplier of the total bet for 3 / 4 / 5 of a kind on a payline. */
  payouts: { 3: number; 4: number; 5: number };
}

export interface SlotsConfig {
  reels: 5;
  rows: 3;
  paylines: number[][];
  paytable: SlotsPaytableEntry[];
  wild: SlotSymbol;
  scatter: SlotSymbol;
  scatterPayouts: { 3: number; 4: number; 5: number };
  betOptionsMinor: number[];
}

export const PlaySlotsSchema = z.object({
  sessionId: z.uuid(),
  betMinor: z.number().int().positive(),
  idempotencyKey: IdempotencyKeySchema,
});
export type PlaySlotsInput = z.infer<typeof PlaySlotsSchema>;

export interface SlotsWinLine {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;
  multiplier: number;
  winMinor: number;
  positions: [number, number][]; // [reel,row]
}

export interface SlotsRoundResult {
  grid: SlotSymbol[][]; // [reel][row]
  wins: SlotsWinLine[];
  scatterCount: number;
  scatterWinMinor: number;
  totalWinMultiplier: number;
}

// ───────────── Dice ─────────────
export interface DiceConfig {
  minTarget: number;
  maxTarget: number;
  houseEdgeBp: number;
  betOptionsMinor: number[];
}

export const PlayDiceSchema = z.object({
  sessionId: z.uuid(),
  betMinor: z.number().int().positive(),
  direction: z.enum(['OVER', 'UNDER']),
  /** Roll result is an integer in [0, 10000] shown as 0.00–100.00. Target in the same scale. */
  target: z.number().int().min(100).max(9900),
  idempotencyKey: IdempotencyKeySchema,
});
export type PlayDiceInput = z.infer<typeof PlayDiceSchema>;

export interface DiceRoundResult {
  roll: number;
  direction: 'OVER' | 'UNDER';
  target: number;
  winChanceBp: number;
  multiplierBp: number;
  won: boolean;
}

// ───────────── Roulette ─────────────
export const RouletteBetTypes = [
  'STRAIGHT',
  'RED',
  'BLACK',
  'ODD',
  'EVEN',
  'LOW',
  'HIGH',
  'DOZEN_1',
  'DOZEN_2',
  'DOZEN_3',
  'COLUMN_1',
  'COLUMN_2',
  'COLUMN_3',
] as const;
export type RouletteBetType = (typeof RouletteBetTypes)[number];

export const RouletteBetSchema = z.object({
  type: z.enum(RouletteBetTypes),
  /** Required for STRAIGHT (0-36). */
  number: z.number().int().min(0).max(36).optional(),
  amountMinor: z.number().int().positive(),
});
export type RouletteBet = z.infer<typeof RouletteBetSchema>;

export const PlayRouletteSchema = z.object({
  sessionId: z.uuid(),
  bets: z.array(RouletteBetSchema).min(1).max(40),
  idempotencyKey: IdempotencyKeySchema,
});
export type PlayRouletteInput = z.infer<typeof PlayRouletteSchema>;

export interface RouletteConfig {
  wheelOrder: number[];
  redNumbers: number[];
  payouts: Record<RouletteBetType, number>; // "to 1" multipliers
  chipOptionsMinor: number[];
  maxBetsPerSpin: number;
}

export interface RouletteRoundResult {
  winningNumber: number;
  color: 'RED' | 'BLACK' | 'GREEN';
  bets: (RouletteBet & { won: boolean; payoutMinor: number })[];
  totalStakeMinor: number;
  totalPayoutMinor: number;
}

// ───────────── Crash ─────────────
export const CrashRoundStatuses = ['WAITING', 'BETTING_OPEN', 'RUNNING', 'CRASHED', 'SETTLED'] as const;
export type CrashRoundStatus = (typeof CrashRoundStatuses)[number];

export interface CrashConfig {
  bettingWindowMs: number;
  waitingMs: number;
  settleDelayMs: number;
  houseEdgeBp: number;
  maxMultiplierBp: number;
  betOptionsMinor: number[];
}

export const CrashPlaceBetSchema = z.object({
  roundId: z.uuid(),
  stakeMinor: z.number().int().positive(),
  /** Optional auto cash-out multiplier in basis points (>= 1.01x). */
  autoCashoutBp: z.number().int().min(10_100).max(100_000_000).optional(),
  idempotencyKey: IdempotencyKeySchema,
});
export type CrashPlaceBetInput = z.infer<typeof CrashPlaceBetSchema>;

export const CrashCashoutSchema = z.object({ roundId: z.uuid() });
export type CrashCashoutInput = z.infer<typeof CrashCashoutSchema>;

export interface CrashBetDto {
  id: string;
  userId: string;
  displayName: string;
  stakeMinor: number;
  autoCashoutBp: number | null;
  status: 'PLACED' | 'CASHED_OUT' | 'LOST' | 'REFUNDED';
  cashoutMultiplierBp: number | null;
  payoutMinor: number;
}

export interface CrashRoundDto {
  id: string;
  seq: number;
  status: CrashRoundStatus;
  serverSeedHash: string;
  serverSeed: string | null;
  crashMultiplierBp: number | null;
  bettingOpensAt: string;
  startsAt: string;
  crashedAt: string | null;
  /** Server time when the snapshot was produced; clients use it to compensate drift. */
  serverTime: string;
  bets: CrashBetDto[];
}

export interface CrashHistoryItem {
  id: string;
  seq: number;
  crashMultiplierBp: number;
  crashedAt: string;
}

// ───────────── Rounds ─────────────
export interface GameRoundDto {
  id: string;
  sessionId: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  engine: GameEngine;
  status: 'OPEN' | 'SETTLED' | 'VOIDED';
  stakeMinor: number;
  payoutMinor: number;
  input: unknown;
  result: SlotsRoundResult | DiceRoundResult | RouletteRoundResult | unknown;
  rngSeedHash: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface PlayRoundResponse<TResult = unknown> {
  round: GameRoundDto & { result: TResult };
  wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number };
  loyaltyPointsAwarded: number;
}

export const RoundListQuerySchema = z.object({
  gameSlug: z.string().max(64).optional(),
  engine: z.enum(['SLOTS', 'DICE', 'ROULETTE', 'CRASH']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type RoundListQuery = z.infer<typeof RoundListQuerySchema>;
