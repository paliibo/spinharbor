import type { RouletteBet, RouletteBetType, RouletteConfig, RouletteRoundResult } from '@spinharbor/contracts';
import type { Rng } from './rng';

/**
 * "Harbor Roulette" – European single-zero wheel.
 * Supported wagers (MVP subset): straight-up, red/black, odd/even, low/high (1-18 / 19-36),
 * dozens and columns. Payouts are the standard "to 1" odds; a winning bet returns stake + stake*odds.
 * Zero loses every outside bet.
 */
export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const ROULETTE_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const ROULETTE_CONFIG: RouletteConfig = {
  wheelOrder: ROULETTE_WHEEL_ORDER,
  redNumbers: ROULETTE_RED,
  payouts: {
    STRAIGHT: 35,
    RED: 1,
    BLACK: 1,
    ODD: 1,
    EVEN: 1,
    LOW: 1,
    HIGH: 1,
    DOZEN_1: 2,
    DOZEN_2: 2,
    DOZEN_3: 2,
    COLUMN_1: 2,
    COLUMN_2: 2,
    COLUMN_3: 2,
  },
  chipOptionsMinor: [100, 500, 1000, 2500, 5000],
  maxBetsPerSpin: 40,
};

export function rouletteColor(n: number): 'RED' | 'BLACK' | 'GREEN' {
  if (n === 0) return 'GREEN';
  return ROULETTE_RED.includes(n) ? 'RED' : 'BLACK';
}

export function rouletteBetWins(bet: Pick<RouletteBet, 'type' | 'number'>, n: number): boolean {
  if (n === 0) return bet.type === 'STRAIGHT' && bet.number === 0;
  switch (bet.type as RouletteBetType) {
    case 'STRAIGHT':
      return bet.number === n;
    case 'RED':
      return rouletteColor(n) === 'RED';
    case 'BLACK':
      return rouletteColor(n) === 'BLACK';
    case 'ODD':
      return n % 2 === 1;
    case 'EVEN':
      return n % 2 === 0;
    case 'LOW':
      return n >= 1 && n <= 18;
    case 'HIGH':
      return n >= 19 && n <= 36;
    case 'DOZEN_1':
      return n >= 1 && n <= 12;
    case 'DOZEN_2':
      return n >= 13 && n <= 24;
    case 'DOZEN_3':
      return n >= 25 && n <= 36;
    case 'COLUMN_1':
      return n % 3 === 1;
    case 'COLUMN_2':
      return n % 3 === 2;
    case 'COLUMN_3':
      return n % 3 === 0;
  }
}

export function validateRouletteBets(bets: RouletteBet[]): string | null {
  if (bets.length === 0) return 'At least one bet is required';
  if (bets.length > ROULETTE_CONFIG.maxBetsPerSpin) return 'Too many bets';
  for (const b of bets) {
    if (b.type === 'STRAIGHT' && (b.number === undefined || b.number < 0 || b.number > 36)) return 'Straight bets need a number 0-36';
    if (b.amountMinor <= 0) return 'Bet amount must be positive';
  }
  return null;
}

export function settleRoulette(winningNumber: number, bets: RouletteBet[]): RouletteRoundResult & { totalPayoutMinorBig: bigint; totalStakeMinorBig: bigint } {
  let totalStake = 0n;
  let totalPayout = 0n;
  const settled = bets.map((bet) => {
    const won = rouletteBetWins(bet, winningNumber);
    const amount = BigInt(bet.amountMinor);
    const payout = won ? amount * BigInt(ROULETTE_CONFIG.payouts[bet.type] + 1) : 0n;
    totalStake += amount;
    totalPayout += payout;
    return { ...bet, won, payoutMinor: Number(payout) };
  });
  return {
    winningNumber,
    color: rouletteColor(winningNumber),
    bets: settled,
    totalStakeMinor: Number(totalStake),
    totalPayoutMinor: Number(totalPayout),
    totalPayoutMinorBig: totalPayout,
    totalStakeMinorBig: totalStake,
  };
}

export function spinRoulette(rng: Rng): number {
  return rng.nextInt(37);
}

export function playRoulette(rng: Rng, bets: RouletteBet[]) {
  return settleRoulette(spinRoulette(rng), bets);
}
