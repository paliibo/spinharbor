/** Static demo catalogue. All names, artwork and providers are fictional. */
import type { Prisma } from '@prisma/client';

export const DEMO_PASSWORDS = {
  player: 'Player123!',
  support: 'Support123!',
  operator: 'Operator123!',
  admin: 'Admin123!',
};

export const PLAYER_NAMES = [
  ['marina_k', 'Marina K.', 'DE'],
  ['tidewalker', 'Tide Walker', 'NL'],
  ['saltyjack', 'Salty Jack', 'GB'],
  ['nova_reels', 'Nova', 'SE'],
  ['captain_ola', 'Captain Ola', 'NO'],
  ['pixel_pirate', 'Pixel Pirate', 'PL'],
  ['luna_bay', 'Luna Bay', 'ES'],
  ['dockmaster', 'Dockmaster', 'DK'],
  ['anchor_ann', 'Anchor Ann', 'IE'],
  ['reef_rider', 'Reef Rider', 'PT'],
  ['harbor_hank', 'Harbor Hank', 'FI'],
  ['coral_cat', 'Coral Cat', 'IT'],
  ['stormy_sue', 'Stormy Sue', 'AT'],
  ['lighthouse_leo', 'Lighthouse Leo', 'CZ'],
  ['pearl_diver', 'Pearl Diver', 'GR'],
  ['northwind', 'Northwind', 'EE'],
  ['seabreeze', 'Sea Breeze', 'FR'],
  ['kraken_kim', 'Kraken Kim', 'LT'],
  ['driftwood', 'Driftwood', 'BE'],
  ['marlin_max', 'Marlin Max', 'CH'],
] as const;

export const CATEGORIES = [
  { slug: 'originals', name: 'SpinHarbor Originals', description: 'Games built in-house with fully playable engines', icon: 'anchor', sortOrder: 0 },
  { slug: 'slots', name: 'Slots', description: 'Video slots and classic reels', icon: 'cherry', sortOrder: 1 },
  { slug: 'table-games', name: 'Table Games', description: 'Roulette, blackjack and baccarat', icon: 'layout-grid', sortOrder: 2 },
  { slug: 'instant', name: 'Instant Win', description: 'Fast single-round games', icon: 'zap', sortOrder: 3 },
  { slug: 'crash', name: 'Crash', description: 'Multiplayer multiplier games', icon: 'rocket', sortOrder: 4 },
  { slug: 'jackpots', name: 'Jackpots', description: 'Progressive-style jackpot themes', icon: 'gem', sortOrder: 5 },
];

export const PROVIDERS = [
  { code: 'spinharbor-studios', name: 'SpinHarbor Studios', integrationType: 'INTERNAL', status: 'OPERATIONAL', description: 'In-house engines running inside the platform (seamless wallet).', config: { rngSource: 'node:crypto', engines: ['SLOTS', 'DICE', 'ROULETTE', 'CRASH'] } },
  { code: 'northwind-gaming', name: 'Northwind Gaming', integrationType: 'SEAMLESS_WALLET', status: 'NOT_CONFIGURED', description: 'Fictional third-party studio. Adapter stub documents the seamless-wallet callback surface; no live endpoint.', config: { baseUrl: 'https://api.northwind.example/v2', callbackUrl: '/providers/northwind/callback', apiKeyConfigured: false } },
  { code: 'tidal-labs', name: 'Tidal Labs', integrationType: 'TRANSFER_WALLET', status: 'DISABLED', description: 'Fictional studio integrated via transfer-wallet model. Disabled by operator.', config: { baseUrl: 'https://games.tidal.example', transferMode: 'per-session' } },
] as const;

type Art = { palette: [string, string, string]; motif: string; accent?: string };
export interface GameSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  provider: string;
  engine: 'SLOTS' | 'DICE' | 'ROULETTE' | 'CRASH' | 'DEMO_PREVIEW';
  status?: 'ACTIVE' | 'DISABLED' | 'MAINTENANCE' | 'COMING_SOON';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  rtpLabel: string;
  minBetMinor: number;
  maxBetMinor: number;
  artwork: Art;
  categories: string[];
  isFeatured?: boolean;
  isNew?: boolean;
  sortOrder: number;
  releasedDaysAgo: number;
}

export const GAMES: GameSeed[] = [
  { slug: 'harbor-reels', name: 'Harbor Reels', tagline: '5×3 reels · 10 lines · wild anchors', description: 'The flagship SpinHarbor slot. Five reels, three rows and ten fixed paylines with wild anchors and star scatters. Outcomes are generated on the server; the client only animates the result. Simulated return ≈95.7% (Monte Carlo, not certified).', provider: 'spinharbor-studios', engine: 'SLOTS', volatility: 'MEDIUM', rtpLabel: '95.7%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#6d3df5', '#2a1b5e', '#d4a84b'], motif: 'reels' }, categories: ['originals', 'slots'], isFeatured: true, sortOrder: 0, releasedDaysAgo: 120 },
  { slug: 'harbor-dice', name: 'Harbor Dice', tagline: 'Roll over or under · 99% return', description: 'Pick a target and roll over or under it. The multiplier is derived directly from the win probability with a 1% house edge, so every payout is fully transparent. Rolls are uniform integers 0.00–99.99.', provider: 'spinharbor-studios', engine: 'DICE', volatility: 'LOW', rtpLabel: '99.0%', minBetMinor: 100, maxBetMinor: 25000, artwork: { palette: ['#36d6e7', '#0f3a4a', '#9b6bff'], motif: 'dice' }, categories: ['originals', 'instant'], isFeatured: true, sortOrder: 1, releasedDaysAgo: 110 },
  { slug: 'harbor-roulette', name: 'Harbor Roulette', tagline: 'European single zero', description: 'Classic European roulette with a single zero. Straight-up numbers, red/black, odd/even, high/low, dozens and columns. The winning pocket is drawn server-side and every bet is settled with standard odds.', provider: 'spinharbor-studios', engine: 'ROULETTE', volatility: 'MEDIUM', rtpLabel: '97.3%', minBetMinor: 100, maxBetMinor: 50000, artwork: { palette: ['#d4a84b', '#3a1c1c', '#6d3df5'], motif: 'wheel' }, categories: ['originals', 'table-games'], isFeatured: true, sortOrder: 2, releasedDaysAgo: 100 },
  { slug: 'harbor-crash', name: 'Harbor Crash', tagline: 'Multiplayer · cash out before it crashes', description: 'A shared multiplier climbs until it crashes. Place a bet while betting is open, cash out any time while it is running. The crash point is committed via a seed hash before the round starts and revealed afterwards.', provider: 'spinharbor-studios', engine: 'CRASH', volatility: 'HIGH', rtpLabel: '99.0%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#ff5c7a', '#1b1030', '#36d6e7'], motif: 'rocket' }, categories: ['originals', 'crash'], isFeatured: true, isNew: true, sortOrder: 3, releasedDaysAgo: 20 },
  { slug: 'neptunes-vault', name: "Neptune's Vault", tagline: 'Deep-sea treasures', description: 'Demo preview of an ocean-themed slot with cascading wins. Catalogue entry only – no gameplay engine is attached.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'HIGH', rtpLabel: '96.2%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#1f7a8c', '#06222e', '#36d6e7'], motif: 'ocean' }, categories: ['slots', 'jackpots'], sortOrder: 10, releasedDaysAgo: 90 },
  { slug: 'lucky-lighthouse', name: 'Lucky Lighthouse', tagline: 'Guiding you to wins', description: 'Demo preview of a low-volatility slot with a lighthouse respin feature.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'LOW', rtpLabel: '96.5%', minBetMinor: 100, maxBetMinor: 5000, artwork: { palette: ['#d4a84b', '#2b2410', '#fff2c2'], motif: 'anchor' }, categories: ['slots'], sortOrder: 11, releasedDaysAgo: 85 },
  { slug: 'dragon-tide', name: 'Dragon Tide', tagline: 'Fire meets water', description: 'Demo preview of an Asian-inspired high-volatility slot.', provider: 'northwind-gaming', engine: 'DEMO_PREVIEW', volatility: 'HIGH', rtpLabel: '95.9%', minBetMinor: 200, maxBetMinor: 20000, artwork: { palette: ['#c8102e', '#2a0a0f', '#d4a84b'], motif: 'dragon' }, categories: ['slots'], isFeatured: true, sortOrder: 12, releasedDaysAgo: 60 },
  { slug: 'nebula-spins', name: 'Nebula Spins', tagline: 'Cosmic cluster pays', description: 'Demo preview of a space-themed cluster-pays slot.', provider: 'northwind-gaming', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.0%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#9b6bff', '#120a2e', '#36d6e7'], motif: 'space' }, categories: ['slots'], isNew: true, sortOrder: 13, releasedDaysAgo: 7 },
  { slug: 'gold-rush-pier', name: 'Gold Rush Pier', tagline: 'Coins on the boardwalk', description: 'Demo preview of a coin-collection slot with a hold-and-win bonus.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.1%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#d4a84b', '#3a2a08', '#ffe08a'], motif: 'coins' }, categories: ['slots', 'jackpots'], sortOrder: 14, releasedDaysAgo: 45 },
  { slug: 'frost-harbor', name: 'Frost Harbor', tagline: 'Frozen multipliers', description: 'Demo preview of a winter-themed slot with sticky multipliers.', provider: 'tidal-labs', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.3%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#9ad8ff', '#0b1e33', '#ffffff'], motif: 'frost' }, categories: ['slots'], sortOrder: 15, releasedDaysAgo: 40 },
  { slug: 'volcano-riches', name: 'Volcano Riches', tagline: 'Eruption bonus', description: 'Demo preview of a high-volatility slot with an eruption free-spins feature.', provider: 'tidal-labs', engine: 'DEMO_PREVIEW', volatility: 'HIGH', rtpLabel: '95.5%', minBetMinor: 200, maxBetMinor: 20000, artwork: { palette: ['#ff6a2a', '#2a0d05', '#ffd166'], motif: 'volcano' }, categories: ['slots'], sortOrder: 16, releasedDaysAgo: 70 },
  { slug: 'jungle-jackpot', name: 'Jungle Jackpot', tagline: 'Four-tier jackpot', description: 'Demo preview of a jungle-themed jackpot slot.', provider: 'northwind-gaming', engine: 'DEMO_PREVIEW', volatility: 'HIGH', rtpLabel: '94.8%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#3ad28c', '#06251a', '#d4a84b'], motif: 'jungle' }, categories: ['slots', 'jackpots'], sortOrder: 17, releasedDaysAgo: 55 },
  { slug: 'pharaohs-compass', name: "Pharaoh's Compass", tagline: 'Expanding symbols', description: 'Demo preview of an Egyptian-themed slot with expanding symbols.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.0%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#d4a84b', '#2c1a06', '#6d3df5'], motif: 'pyramid' }, categories: ['slots'], sortOrder: 18, releasedDaysAgo: 150 },
  { slug: 'blackjack-harbor', name: 'Blackjack Harbor', tagline: 'Classic 21', description: 'Demo preview of a single-deck blackjack table. Coming to the engine roadmap.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', status: 'COMING_SOON', volatility: 'LOW', rtpLabel: '99.5%', minBetMinor: 100, maxBetMinor: 50000, artwork: { palette: ['#1d5c3a', '#06160e', '#d4a84b'], motif: 'cards' }, categories: ['table-games'], isNew: true, sortOrder: 19, releasedDaysAgo: 2 },
  { slug: 'baccarat-bay', name: 'Baccarat Bay', tagline: 'Player · Banker · Tie', description: 'Demo preview of a punto banco table.', provider: 'tidal-labs', engine: 'DEMO_PREVIEW', volatility: 'LOW', rtpLabel: '98.9%', minBetMinor: 500, maxBetMinor: 50000, artwork: { palette: ['#b00020', '#1e0a0a', '#d4a84b'], motif: 'cards' }, categories: ['table-games'], sortOrder: 20, releasedDaysAgo: 65 },
  { slug: 'mega-wheel-marina', name: 'Mega Wheel Marina', tagline: 'Spin the big wheel', description: 'Demo preview of a money-wheel game show. Currently in maintenance.', provider: 'northwind-gaming', engine: 'DEMO_PREVIEW', status: 'MAINTENANCE', volatility: 'MEDIUM', rtpLabel: '96.5%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#ff5c7a', '#2a0a14', '#36d6e7'], motif: 'wheel' }, categories: ['table-games', 'instant'], sortOrder: 21, releasedDaysAgo: 30 },
  { slug: 'clover-cove', name: 'Clover Cove', tagline: 'Irish luck', description: 'Demo preview of a classic 3-reel fruit slot.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'LOW', rtpLabel: '96.8%', minBetMinor: 50, maxBetMinor: 5000, artwork: { palette: ['#3ad28c', '#07200f', '#d4a84b'], motif: 'clover' }, categories: ['slots'], sortOrder: 22, releasedDaysAgo: 200 },
  { slug: 'coin-cascade', name: 'Coin Cascade', tagline: 'Instant coin drops', description: 'Demo preview of an instant-win coin drop game.', provider: 'northwind-gaming', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.0%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#36d6e7', '#082a30', '#d4a84b'], motif: 'gems' }, categories: ['instant'], isNew: true, sortOrder: 23, releasedDaysAgo: 5 },
  { slug: 'sakura-reels', name: 'Sakura Reels', tagline: 'Blossom free spins', description: 'Demo preview of a Japanese-garden slot.', provider: 'tidal-labs', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.4%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#ff9ac1', '#2a0a1c', '#9b6bff'], motif: 'fruits' }, categories: ['slots'], sortOrder: 24, releasedDaysAgo: 25 },
  { slug: 'pirates-plunder', name: "Pirate's Plunder", tagline: 'Retired title', description: 'Disabled catalogue entry kept for history. Operators can re-enable it from the games screen.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', status: 'DISABLED', volatility: 'HIGH', rtpLabel: '95.0%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#8a5a2b', '#1c1008', '#d4a84b'], motif: 'anchor' }, categories: ['slots'], sortOrder: 25, releasedDaysAgo: 300 },
  { slug: 'neon-wharf', name: 'Neon Wharf', tagline: 'Synthwave spins', description: 'Demo preview of a retro-futuristic neon slot.', provider: 'spinharbor-studios', engine: 'DEMO_PREVIEW', volatility: 'MEDIUM', rtpLabel: '96.2%', minBetMinor: 100, maxBetMinor: 10000, artwork: { palette: ['#ff2fd2', '#120421', '#36d6e7'], motif: 'neon' }, categories: ['slots'], isFeatured: true, sortOrder: 26, releasedDaysAgo: 15 },
];

export const BONUSES: Prisma.BonusDefinitionCreateInput[] = [
  { code: 'WELCOME_2000', type: 'WELCOME', name: 'Welcome Bonus', description: '2,000 bonus credits on your first claim. Wager 5× before the funds are released to your cash balance.', amountMinor: 200_000n, wageringMultiplier: 5, maxClaimsPerUser: 1, validForHours: 168 },
  { code: 'DAILY_500', type: 'DAILY_REWARD', name: 'Daily Harbor Reward', description: '500 demo credits every 24 hours. Counts towards your daily top-up limit.', amountMinor: 50_000n, wageringMultiplier: 0, claimCooldownHours: 24, validForHours: 24 },
  { code: 'CASHBACK_WEEKLY', type: 'CASHBACK', name: 'Weekly Cashback', description: '10% of your net losses over the last 7 days back as cash, up to 500 credits. Claimable once per week.', amountMinor: 0n, percentBp: 1000, maxAmountMinor: 50_000n, wageringMultiplier: 0, claimCooldownHours: 168, validForHours: 168 },
  { code: 'MILESTONE_SILVER', type: 'LOYALTY_MILESTONE', name: 'Silver Milestone', description: '250 credits for reaching Silver tier.', amountMinor: 25_000n, wageringMultiplier: 0, maxClaimsPerUser: 1, requiredTier: 'SILVER', validForHours: 720 },
  { code: 'MILESTONE_GOLD', type: 'LOYALTY_MILESTONE', name: 'Gold Milestone', description: '1,000 credits for reaching Gold tier.', amountMinor: 100_000n, wageringMultiplier: 0, maxClaimsPerUser: 1, requiredTier: 'GOLD', validForHours: 720 },
  { code: 'MILESTONE_PLATINUM', type: 'LOYALTY_MILESTONE', name: 'Platinum Milestone', description: '5,000 credits for reaching Platinum tier.', amountMinor: 500_000n, wageringMultiplier: 0, maxClaimsPerUser: 1, requiredTier: 'PLATINUM', validForHours: 720 },
];

export const PROMOTIONS = [
  { slug: 'welcome-aboard', title: 'Welcome Aboard', subtitle: '2,000 bonus credits to start your voyage', description: 'Claim the welcome bonus once, wager it 5× on any game and the funds move to your cash balance. Demo credits only – nothing here is withdrawable.', artwork: { palette: ['#6d3df5', '#1b1030', '#d4a84b'], motif: 'anchor' }, ctaLabel: 'Claim welcome bonus', bonus: 'WELCOME_2000', sortOrder: 0 },
  { slug: 'daily-harbor-reward', title: 'Daily Harbor Reward', subtitle: '500 credits, every day', description: 'Come back every 24 hours for a fresh 500 demo credits. Subject to your daily top-up limit.', artwork: { palette: ['#36d6e7', '#082a30', '#9b6bff'], motif: 'coins' }, ctaLabel: 'Claim today', bonus: 'DAILY_500', sortOrder: 1 },
  { slug: 'weekly-cashback', title: 'Weekly Cashback', subtitle: '10% back on net losses', description: 'Every week we return 10% of your net losses (up to 500 credits). The amount is calculated from your actual rounds.', artwork: { palette: ['#3ad28c', '#06251a', '#d4a84b'], motif: 'ocean' }, ctaLabel: 'Check cashback', bonus: 'CASHBACK_WEEKLY', sortOrder: 2 },
  { slug: 'crash-launch', title: 'Harbor Crash has launched', subtitle: 'Multiplayer crash with provably-fair seeds', description: 'Our newest original: a shared multiplier, auto cash-out and a seed hash published before every round.', artwork: { palette: ['#ff5c7a', '#1b1030', '#36d6e7'], motif: 'rocket' }, ctaLabel: 'Play Harbor Crash', bonus: null, sortOrder: 3 },
  { slug: 'loyalty-tiers', title: 'Climb the loyalty tiers', subtitle: 'Bronze → Silver → Gold → Platinum', description: 'Earn 1 point for every 10 credits wagered. Each tier unlocks a milestone reward and better cashback.', artwork: { palette: ['#d4a84b', '#2b2410', '#9b6bff'], motif: 'gems' }, ctaLabel: 'View loyalty', bonus: null, sortOrder: 4 },
];
