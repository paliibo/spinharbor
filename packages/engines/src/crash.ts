import type { CrashConfig } from '@spinharbor/contracts';
import { sha256Hex } from './rng';

/**
 * "Harbor Crash"
 * - Each round has a secret server seed; its SHA-256 hash is published before betting opens and
 *   the seed is revealed after the crash so players can recompute the crash point.
 * - crashPoint = (1 - houseEdge) / (1 - r) where r is the first 52 bits of sha256(seed) as a
 *   uniform number in [0,1). P(crash ≥ x) = (1 - edge)/x, so ~1% of rounds crash instantly at 1.00x.
 * - The multiplier grows exponentially with elapsed time: m(t) = 2^(t / 10s) (doubles every 10s).
 * - A cash-out at server time t pays stake * m(t) only if m(t) < crashPoint.
 */
export const CRASH_CONFIG: CrashConfig = {
  bettingWindowMs: 8_000,
  waitingMs: 3_000,
  settleDelayMs: 3_000,
  houseEdgeBp: 100,
  maxMultiplierBp: 100_000_000, // 10,000x cap
  betOptionsMinor: [100, 500, 1000, 2500, 5000, 10000],
};

const GROWTH_K = Math.LN2 / 10_000; // per millisecond

export function crashPointFromSeed(serverSeed: string, houseEdgeBp = CRASH_CONFIG.houseEdgeBp, maxBp = CRASH_CONFIG.maxMultiplierBp): number {
  const hash = sha256Hex(serverSeed);
  const h = parseInt(hash.slice(0, 13), 16); // 52 bits
  const r = h / 2 ** 52;
  const m = (1 - houseEdgeBp / 10_000) / (1 - r);
  const bp = Math.floor(m * 10_000);
  return Math.max(10_000, Math.min(maxBp, bp));
}

export function crashMultiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 10_000;
  return Math.floor(10_000 * Math.exp(GROWTH_K * elapsedMs));
}

/** Milliseconds after start at which the multiplier reaches `bp`. */
export function crashTimeToReach(bp: number): number {
  if (bp <= 10_000) return 0;
  return Math.ceil(Math.log(bp / 10_000) / GROWTH_K);
}

export function crashPayoutMinor(stakeMinor: bigint, multiplierBp: number): bigint {
  return (stakeMinor * BigInt(multiplierBp)) / 10_000n;
}
