import { z } from 'zod';

export const GameEngines = ['SLOTS', 'DICE', 'ROULETTE', 'CRASH', 'DEMO_PREVIEW'] as const;
export type GameEngine = (typeof GameEngines)[number];
export const GameStatuses = ['ACTIVE', 'DISABLED', 'MAINTENANCE', 'COMING_SOON'] as const;
export type GameStatus = (typeof GameStatuses)[number];
export const Volatilities = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Volatility = (typeof Volatilities)[number];

export const GameSortOptions = ['popular', 'newest', 'az', 'za', 'featured'] as const;
export type GameSort = (typeof GameSortOptions)[number];

export const GameListQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  category: z.string().max(40).optional(),
  provider: z.string().max(40).optional(),
  engine: z.enum(GameEngines).optional(),
  sort: z.enum(GameSortOptions).default('featured'),
  includeDisabled: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type GameListQuery = z.infer<typeof GameListQuerySchema>;

/** Original procedural artwork; the client renders it with CSS/SVG. */
export interface GameArtwork {
  palette: [string, string, string];
  motif:
    | 'reels'
    | 'dice'
    | 'wheel'
    | 'rocket'
    | 'gems'
    | 'fruits'
    | 'cards'
    | 'pyramid'
    | 'ocean'
    | 'dragon'
    | 'neon'
    | 'space'
    | 'jungle'
    | 'frost'
    | 'volcano'
    | 'clover'
    | 'coins'
    | 'anchor';
  accent?: string;
}

export interface GameCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  gameCount?: number;
}

export interface ProviderSummaryDto {
  id: string;
  code: string;
  name: string;
  status: 'OPERATIONAL' | 'DISABLED' | 'ERROR' | 'NOT_CONFIGURED';
  integrationType: 'INTERNAL' | 'SEAMLESS_WALLET' | 'TRANSFER_WALLET';
  gameCount: number;
}

export interface GameSummaryDto {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  engine: GameEngine;
  status: GameStatus;
  volatility: Volatility;
  rtpLabel: string | null;
  minBetMinor: number;
  maxBetMinor: number;
  artwork: GameArtwork;
  isFeatured: boolean;
  isNew: boolean;
  playCount: number;
  releasedAt: string;
  provider: { id: string; code: string; name: string };
  categories: { slug: string; name: string }[];
  isFavorite?: boolean;
  playable: boolean;
}

export interface GameDetailDto extends GameSummaryDto {
  description: string;
  stats: { rounds24h: number; players24h: number; biggestWinMinor: number };
}
