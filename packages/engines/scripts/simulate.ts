/* Monte Carlo RTP estimate for the slots engine. Run: pnpm --filter @spinharbor/engines simulate */
import { playSlots, SecureRng, crashPointFromSeed, SeededRng } from '../src';

const rng = new SecureRng();
const n = Number(process.argv[2] ?? 300_000);
const bet = 1000n;
let paid = 0n;
let hits = 0;
for (let i = 0; i < n; i++) {
  const r = playSlots(rng, bet);
  paid += r.totalWinMinor;
  if (r.totalWinMinor > 0n) hits++;
}
console.log(`slots: spins=${n} RTP=${((Number(paid) / (n * Number(bet))) * 100).toFixed(2)}% hitRate=${((hits / n) * 100).toFixed(1)}%`);

const s = new SeededRng(42);
let sum = 0;
const m = 200_000;
for (let i = 0; i < m; i++) sum += Math.min(crashPointFromSeed(s.seedHex(16)), 1_000_000) / 10_000;
console.log(`crash: mean crash point (capped 100x) = ${(sum / m).toFixed(3)}x`);
