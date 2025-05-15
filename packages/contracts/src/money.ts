/**
 * All amounts travel over the wire as integer "minor units" (1 credit = 100 minor units).
 * The backend stores and computes with BigInt; the client only formats. JS numbers are safe
 * for this range (max 2^53 minor units ≈ 90 trillion credits), and the API refuses to
 * serialize anything larger.
 */
export const MINOR_PER_CREDIT = 100;
export const DEMO_CURRENCY = 'DMC';

export function minorToCredits(minor: number): number {
  return minor / MINOR_PER_CREDIT;
}

export function creditsToMinor(credits: number): number {
  return Math.round(credits * MINOR_PER_CREDIT);
}

export function formatCredits(minor: number | string | bigint, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const n = typeof minor === 'bigint' ? Number(minor) : Number(minor);
  const credits = n / MINOR_PER_CREDIT;
  const abs = Math.abs(credits);
  let body: string;
  if (opts.compact && abs >= 1_000_000) body = (abs / 1_000_000).toFixed(2) + 'M';
  else if (opts.compact && abs >= 10_000) body = (abs / 1_000).toFixed(1) + 'K';
  else body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = credits < 0 ? '-' : opts.sign && credits > 0 ? '+' : '';
  return `${sign}${body}`;
}

/** Basis points helpers (multipliers are integers: 24500 = 2.45x). */
export const BP = 10_000;
export function bpToMultiplier(bp: number): number {
  return bp / BP;
}
export function formatMultiplier(bp: number): string {
  return `${(bp / BP).toFixed(2)}x`;
}
