import type { SlotsConfig, SlotsRoundResult, SlotsWinLine, SlotSymbol } from '@spinharbor/contracts';
import type { Rng } from './rng';

/**
 * "Harbor Reels" – 5x3 video slot, 10 fixed paylines.
 *
 * Calculation model
 * - The total bet is split evenly over 10 paylines: lineBet = bet / 10 (bets must be multiples of 10 minor units).
 * - Each reel is a weighted strip; a spin picks one stop per reel and shows 3 consecutive symbols.
 * - A payline pays for the longest run of identical symbols starting from reel 1 (left to right).
 *   ANCHOR is wild and substitutes any symbol except STAR (scatter). A run of only wilds pays as ANCHOR.
 * - STAR scatters pay on total bet anywhere on the grid (3/4/5 → 2x/10x/50x total bet).
 * - Line wins are summed; only the best run per line is paid.
 * - The simulated RTP (Monte Carlo, scripts/simulate.ts) is ≈96%. This is not a certified RTP.
 */
export const SLOTS_PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 1, 1, 0],
];

export const SLOTS_CONFIG: SlotsConfig = {
  reels: 5,
  rows: 3,
  paylines: SLOTS_PAYLINES,
  wild: 'ANCHOR',
  scatter: 'STAR',
  paytable: [
    { symbol: 'ANCHOR', payouts: { 3: 50, 4: 200, 5: 1000 } },
    { symbol: 'GEM', payouts: { 3: 30, 4: 120, 5: 500 } },
    { symbol: 'CROWN', payouts: { 3: 20, 4: 80, 5: 300 } },
    { symbol: 'BELL', payouts: { 3: 15, 4: 50, 5: 150 } },
    { symbol: 'SEVEN', payouts: { 3: 10, 4: 30, 5: 100 } },
    { symbol: 'CHERRY', payouts: { 3: 5, 4: 18, 5: 60 } },
    { symbol: 'LEMON', payouts: { 3: 4, 4: 10, 5: 40 } },
  ],
  scatterPayouts: { 3: 2, 4: 10, 5: 50 },
  betOptionsMinor: [100, 200, 500, 1000, 2000, 5000, 10000],
};

/** Weighted reel strips. Symbol frequency decreases with value; wilds and scatters are rare. */
const STRIP_WEIGHTS: Record<SlotSymbol, number>[] = [
  { ANCHOR: 2, GEM: 3, CROWN: 4, BELL: 5, SEVEN: 6, CHERRY: 8, LEMON: 9, STAR: 2 },
  { ANCHOR: 2, GEM: 3, CROWN: 4, BELL: 5, SEVEN: 6, CHERRY: 8, LEMON: 9, STAR: 2 },
  { ANCHOR: 2, GEM: 3, CROWN: 4, BELL: 5, SEVEN: 6, CHERRY: 8, LEMON: 9, STAR: 2 },
  { ANCHOR: 2, GEM: 3, CROWN: 4, BELL: 5, SEVEN: 6, CHERRY: 8, LEMON: 9, STAR: 2 },
  { ANCHOR: 2, GEM: 3, CROWN: 4, BELL: 5, SEVEN: 6, CHERRY: 8, LEMON: 9, STAR: 2 },
];

export const SLOTS_REEL_STRIPS: SlotSymbol[][] = STRIP_WEIGHTS.map((weights) => {
  const strip: SlotSymbol[] = [];
  // Interleave symbols so identical symbols are not adjacent on the strip more than necessary.
  const entries = Object.entries(weights) as [SlotSymbol, number][];
  const max = Math.max(...entries.map(([, w]) => w));
  for (let i = 0; i < max; i++) for (const [sym, w] of entries) if (i < w) strip.push(sym);
  return strip;
});

export function spinSlots(rng: Rng): SlotSymbol[][] {
  return SLOTS_REEL_STRIPS.map((strip) => {
    const stop = rng.nextInt(strip.length);
    return [0, 1, 2].map((r) => strip[(stop + r) % strip.length]);
  });
}

export function evaluateSlots(grid: SlotSymbol[][], betMinor: bigint): SlotsRoundResult & { totalWinMinor: bigint } {
  const lineBet = betMinor / 10n;
  const wins: SlotsWinLine[] = [];
  const payouts = new Map(SLOTS_CONFIG.paytable.map((p) => [p.symbol, p.payouts]));

  SLOTS_CONFIG.paylines.forEach((rows, lineIndex) => {
    const symbols = rows.map((row, reel) => grid[reel][row]);
    let lineSymbol: SlotSymbol | null = null;
    let count = 0;
    for (const s of symbols) {
      if (s === SLOTS_CONFIG.scatter) break;
      if (s === SLOTS_CONFIG.wild) {
        count++;
        continue;
      }
      if (lineSymbol === null) {
        lineSymbol = s;
        count++;
      } else if (s === lineSymbol) count++;
      else break;
    }
    const paySymbol = lineSymbol ?? SLOTS_CONFIG.wild;
    if (count >= 3) {
      const multiplier = payouts.get(paySymbol)?.[count as 3 | 4 | 5] ?? 0;
      if (multiplier > 0) {
        wins.push({
          lineIndex,
          symbol: paySymbol,
          count,
          multiplier,
          winMinor: Number(lineBet * BigInt(multiplier)),
          positions: rows.slice(0, count).map((row, reel) => [reel, row] as [number, number]),
        });
      }
    }
  });

  let scatterCount = 0;
  for (const reel of grid) for (const s of reel) if (s === SLOTS_CONFIG.scatter) scatterCount++;
  const scatterMultiplier = scatterCount >= 3 ? SLOTS_CONFIG.scatterPayouts[Math.min(scatterCount, 5) as 3 | 4 | 5] : 0;
  const scatterWin = betMinor * BigInt(scatterMultiplier);

  const totalWin = wins.reduce((acc, w) => acc + BigInt(w.winMinor), 0n) + scatterWin;
  return {
    grid,
    wins,
    scatterCount,
    scatterWinMinor: Number(scatterWin),
    totalWinMultiplier: betMinor > 0n ? Number((totalWin * 100n) / betMinor) / 100 : 0,
    totalWinMinor: totalWin,
  };
}

export function playSlots(rng: Rng, betMinor: bigint) {
  return evaluateSlots(spinSlots(rng), betMinor);
}
