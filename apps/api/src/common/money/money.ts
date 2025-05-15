export const MINOR_PER_CREDIT = 100n;

export function creditsToMinor(credits: number): bigint {
  return BigInt(Math.round(credits * 100));
}

export function toBig(n: number | bigint | string): bigint {
  return typeof n === 'bigint' ? n : BigInt(n);
}

export function fmt(minor: bigint): string {
  const sign = minor < 0n ? '-' : '';
  const abs = minor < 0n ? -minor : minor;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toLocaleString('en-US')}.${frac.toString().padStart(2, '0')}`;
}

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfUtcWeek(d = new Date()): Date {
  const day = startOfUtcDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * 86_400_000);
}
