import { formatCredits } from '@spinharbor/contracts';
export { formatCredits, formatMultiplier, minorToCredits, creditsToMinor, bpToMultiplier, MINOR_PER_CREDIT, DEMO_CURRENCY } from '@spinharbor/contracts';

/** Balance formatting used everywhere a monetary value is rendered. */
export function credits(minor: number | string | null | undefined, opts?: { sign?: boolean; compact?: boolean }): string {
  if (minor === null || minor === undefined) return '—';
  return formatCredits(Number(minor), opts);
}
