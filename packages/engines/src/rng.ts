import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Randomness abstraction. Production uses the OS CSPRNG via node:crypto; tests inject
 * a seeded generator so outcomes are reproducible. This is a simulation-grade RNG, not a
 * certified gaming RNG.
 */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Uniform float in [0, 1). */
  nextFloat(): number;
  /** Hex string of n random bytes (used for provably-fair style seeds). */
  seedHex(bytes?: number): string;
}

export class SecureRng implements Rng {
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('maxExclusive must be a positive integer');
    return randomInt(0, maxExclusive);
  }
  nextFloat(): number {
    // 52 random bits -> [0,1)
    return randomInt(0, 2 ** 48) / 2 ** 48;
  }
  seedHex(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }
}

/** Deterministic mulberry32 generator for tests and seed data. */
export class SeededRng implements Rng {
  private state: number;
  constructor(seed: number | string) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashToUint32(seed);
  }
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  nextFloat(): number {
    return this.next();
  }
  seedHex(bytes = 32): string {
    let out = '';
    for (let i = 0; i < bytes; i++) out += this.nextInt(256).toString(16).padStart(2, '0');
    return out;
  }
}

/** Fixed-sequence RNG: returns the given values in order (tests of exact outcomes). */
export class FixedRng implements Rng {
  private i = 0;
  constructor(private readonly ints: number[], private readonly floats: number[] = []) {}
  nextInt(maxExclusive: number): number {
    const v = this.ints[this.i++ % this.ints.length] ?? 0;
    return v % maxExclusive;
  }
  nextFloat(): number {
    return this.floats[this.i++ % Math.max(1, this.floats.length)] ?? 0;
  }
  seedHex(): string {
    return 'f'.repeat(64);
  }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hashToUint32(s: string): number {
  const h = createHash('sha256').update(s).digest();
  return h.readUInt32BE(0);
}
