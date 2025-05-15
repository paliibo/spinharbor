import { crashMultiplierAt, crashPayoutMinor, crashPointFromSeed, crashTimeToReach, diceMultiplierBp, dicePayoutMinor, diceWinChanceBp, evaluateSlots, FixedRng, playDice, playSlots, resolveDice, rouletteBetWins, rouletteColor, SeededRng, settleRoulette, SLOTS_CONFIG, spinSlots, validateRouletteBets } from '@spinharbor/engines';
import type { SlotSymbol } from '@spinharbor/contracts';

describe('slots engine', () => {
  const grid = (rows: SlotSymbol[][]): SlotSymbol[][] => rows; // [reel][row]

  it('pays a 5-of-a-kind on the middle line as lineBet × multiplier', () => {
    const g = grid([
      ['LEMON', 'GEM', 'LEMON'],
      ['LEMON', 'GEM', 'LEMON'],
      ['LEMON', 'GEM', 'LEMON'],
      ['LEMON', 'GEM', 'LEMON'],
      ['LEMON', 'GEM', 'LEMON'],
    ]);
    const r = evaluateSlots(g, 1000n);
    // line 0 (middle row) GEM ×5 = 500 × lineBet(100); lines 1 and 2 (top/bottom) LEMON ×5 = 40 × 100 each
    const gem = r.wins.find((w) => w.symbol === 'GEM' && w.lineIndex === 0)!;
    expect(gem.count).toBe(5);
    expect(gem.winMinor).toBe(50_000);
    expect(r.wins.filter((w) => w.symbol === 'LEMON').length).toBeGreaterThanOrEqual(2);
    expect(r.totalWinMinor).toBeGreaterThanOrEqual(50_000n + 8_000n);
  });

  it('treats ANCHOR as wild and pays the substituted symbol', () => {
    const g = grid([
      ['CHERRY', 'ANCHOR', 'CHERRY'],
      ['CHERRY', 'CROWN', 'CHERRY'],
      ['CHERRY', 'CROWN', 'CHERRY'],
      ['CHERRY', 'LEMON', 'CHERRY'],
      ['CHERRY', 'LEMON', 'CHERRY'],
    ]);
    const r = evaluateSlots(g, 1000n);
    const middle = r.wins.find((w) => w.lineIndex === 0)!;
    expect(middle.symbol).toBe('CROWN');
    expect(middle.count).toBe(3);
    expect(middle.winMinor).toBe(100 * 20);
  });

  it('pays scatters anywhere on total bet and never on lines', () => {
    const g = grid([
      ['STAR', 'LEMON', 'CHERRY'],
      ['LEMON', 'STAR', 'CHERRY'],
      ['CHERRY', 'LEMON', 'STAR'],
      ['LEMON', 'CHERRY', 'LEMON'],
      ['CHERRY', 'LEMON', 'CHERRY'],
    ]);
    const r = evaluateSlots(g, 1000n);
    expect(r.scatterCount).toBe(3);
    expect(r.scatterWinMinor).toBe(2000);
  });

  it('returns zero for a losing grid', () => {
    const g = grid([
      ['LEMON', 'LEMON', 'LEMON'],
      ['CHERRY', 'CHERRY', 'CHERRY'],
      ['SEVEN', 'SEVEN', 'SEVEN'],
      ['LEMON', 'LEMON', 'LEMON'],
      ['CHERRY', 'CHERRY', 'CHERRY'],
    ]);
    expect(evaluateSlots(g, 1000n).totalWinMinor).toBe(0n);
  });

  it('is deterministic for a seeded RNG and always produces a 5x3 grid of known symbols', () => {
    const a = playSlots(new SeededRng('x'), 500n);
    const b = playSlots(new SeededRng('x'), 500n);
    expect(a.grid).toEqual(b.grid);
    expect(a.grid).toHaveLength(5);
    for (const reel of a.grid) {
      expect(reel).toHaveLength(3);
      for (const s of reel) expect(SLOTS_CONFIG.paytable.map((p) => p.symbol).concat('STAR')).toContain(s);
    }
    expect(spinSlots(new FixedRng([0, 0, 0, 0, 0]))[0]).toHaveLength(3);
  });

  it('simulated return stays within a sane band (not a certified RTP)', () => {
    const rng = new SeededRng(42);
    let paid = 0n;
    const n = 20_000;
    for (let i = 0; i < n; i++) paid += playSlots(rng, 1000n).totalWinMinor;
    const rtp = Number(paid) / (n * 1000);
    expect(rtp).toBeGreaterThan(0.85);
    expect(rtp).toBeLessThan(1.05);
  });
});

describe('dice engine', () => {
  it('computes win chance and multiplier from the documented formula', () => {
    expect(diceWinChanceBp('OVER', 5000)).toBe(4999);
    expect(diceWinChanceBp('UNDER', 5000)).toBe(5000);
    expect(diceMultiplierBp('UNDER', 5000)).toBe(19_800); // 0.99 / 0.5 = 1.98x
    expect(diceMultiplierBp('OVER', 9900)).toBe(Math.floor((9900 * 10000) / 99)); // 1% chance → 100x
    expect(dicePayoutMinor(1000n, 19_800)).toBe(1980n);
  });

  it('resolves win/loss strictly over or under the target', () => {
    expect(resolveDice(5000, { direction: 'OVER', target: 5000, stakeMinor: 100n }).won).toBe(false);
    expect(resolveDice(5001, { direction: 'OVER', target: 5000, stakeMinor: 100n }).won).toBe(true);
    expect(resolveDice(4999, { direction: 'UNDER', target: 5000, stakeMinor: 100n }).won).toBe(true);
    expect(resolveDice(5000, { direction: 'UNDER', target: 5000, stakeMinor: 100n }).won).toBe(false);
  });

  it('uses the injected RNG for the roll and pays stake × multiplier', () => {
    const r = playDice(new FixedRng([8470]), { direction: 'OVER', target: 5000, stakeMinor: 1000n });
    expect(r.roll).toBe(8470);
    expect(r.won).toBe(true);
    expect(r.payoutMinor).toBe(1980n);
    expect(() => playDice(new FixedRng([1]), { direction: 'OVER', target: 9950, stakeMinor: 1n })).toThrow();
  });

  it('expected return is 99% (house edge 1%) across all targets', () => {
    for (const target of [100, 2500, 5000, 7500, 9900]) {
      for (const direction of ['OVER', 'UNDER'] as const) {
        const chance = diceWinChanceBp(direction, target) / 10_000;
        const mult = diceMultiplierBp(direction, target) / 10_000;
        expect(chance * mult).toBeGreaterThan(0.985);
        expect(chance * mult).toBeLessThanOrEqual(0.99 + 1e-9);
      }
    }
  });
});

describe('roulette engine', () => {
  it('maps colours and bet coverage correctly', () => {
    expect(rouletteColor(0)).toBe('GREEN');
    expect(rouletteColor(1)).toBe('RED');
    expect(rouletteColor(2)).toBe('BLACK');
    expect(rouletteBetWins({ type: 'RED' }, 0)).toBe(false);
    expect(rouletteBetWins({ type: 'EVEN' }, 0)).toBe(false);
    expect(rouletteBetWins({ type: 'STRAIGHT', number: 0 }, 0)).toBe(true);
    expect(rouletteBetWins({ type: 'COLUMN_3' }, 36)).toBe(true);
    expect(rouletteBetWins({ type: 'DOZEN_2' }, 13)).toBe(true);
    expect(rouletteBetWins({ type: 'HIGH' }, 18)).toBe(false);
  });

  it('settles a mixed bet slip with standard odds', () => {
    const r = settleRoulette(17, [
      { type: 'STRAIGHT', number: 17, amountMinor: 100 },
      { type: 'BLACK', amountMinor: 500 },
      { type: 'RED', amountMinor: 500 },
      { type: 'DOZEN_2', amountMinor: 200 },
    ]);
    expect(r.color).toBe('BLACK');
    expect(r.bets[0].payoutMinor).toBe(3600); // 35:1 + stake
    expect(r.bets[1].payoutMinor).toBe(1000);
    expect(r.bets[2].payoutMinor).toBe(0);
    expect(r.bets[3].payoutMinor).toBe(600);
    expect(r.totalStakeMinor).toBe(1300);
    expect(r.totalPayoutMinor).toBe(5200);
  });

  it('validates bets', () => {
    expect(validateRouletteBets([])).toBeTruthy();
    expect(validateRouletteBets([{ type: 'STRAIGHT', amountMinor: 100 }])).toBeTruthy();
    expect(validateRouletteBets([{ type: 'RED', amountMinor: 100 }])).toBeNull();
  });
});

describe('crash engine', () => {
  it('derives a crash point ≥ 1.00x deterministically from the seed', () => {
    const a = crashPointFromSeed('seed-1');
    expect(a).toBe(crashPointFromSeed('seed-1'));
    expect(a).toBeGreaterThanOrEqual(10_000);
    let instant = 0;
    const rng = new SeededRng(7);
    for (let i = 0; i < 5000; i++) if (crashPointFromSeed(rng.seedHex(8)) === 10_000) instant++;
    expect(instant / 5000).toBeGreaterThan(0.002);
    expect(instant / 5000).toBeLessThan(0.03);
  });

  it('multiplier doubles every 10 seconds and time/multiplier are inverse', () => {
    expect(crashMultiplierAt(0)).toBe(10_000);
    expect(crashMultiplierAt(10_000)).toBeGreaterThanOrEqual(19_990);
    expect(crashMultiplierAt(10_000)).toBeLessThanOrEqual(20_000);
    expect(crashMultiplierAt(crashTimeToReach(30_000))).toBeGreaterThanOrEqual(30_000);
    expect(crashPayoutMinor(1000n, 24_500)).toBe(2450n);
  });
});
