import type { DiceConfig, DiceRoundResult } from '@spinharbor/contracts';
import type { Rng } from './rng';

/**
 * "Harbor Dice"
 * - The roll is a uniform integer in [0, 9999], displayed as 0.00–99.99.
 * - OVER target wins when roll > target; UNDER target wins when roll < target.
 * - Win chance (in basis points of 10,000 outcomes) is exactly the number of winning rolls.
 * - multiplier = (1 - houseEdge) / winChance, expressed in basis points and floored.
 * - payout = stake * multiplier (floored to minor units). Expected return = 1 - houseEdge = 99%.
 */
export const DICE_CONFIG: DiceConfig = {
  minTarget: 100,
  maxTarget: 9900,
  houseEdgeBp: 100,
  betOptionsMinor: [100, 500, 1000, 2500, 5000, 10000, 25000],
};

export const DICE_OUTCOMES = 10_000;

export function diceWinChanceBp(direction: 'OVER' | 'UNDER', target: number): number {
  return direction === 'OVER' ? DICE_OUTCOMES - 1 - target : target;
}

export function diceMultiplierBp(direction: 'OVER' | 'UNDER', target: number, houseEdgeBp = DICE_CONFIG.houseEdgeBp): number {
  const chance = diceWinChanceBp(direction, target);
  if (chance <= 0) throw new Error('Target leaves no winning outcomes');
  // (10000 - edge) * 10000 / chance, all integer arithmetic
  return Math.floor(((10_000 - houseEdgeBp) * 10_000) / chance);
}

export function dicePayoutMinor(stakeMinor: bigint, multiplierBp: number): bigint {
  return (stakeMinor * BigInt(multiplierBp)) / 10_000n;
}

export function playDice(rng: Rng, input: { direction: 'OVER' | 'UNDER'; target: number; stakeMinor: bigint }): DiceRoundResult & { payoutMinor: bigint } {
  if (input.target < DICE_CONFIG.minTarget || input.target > DICE_CONFIG.maxTarget) throw new Error('Target out of range');
  const roll = rng.nextInt(DICE_OUTCOMES);
  return resolveDice(roll, input);
}

export function resolveDice(roll: number, input: { direction: 'OVER' | 'UNDER'; target: number; stakeMinor: bigint }) {
  const winChanceBp = diceWinChanceBp(input.direction, input.target);
  const multiplierBp = diceMultiplierBp(input.direction, input.target);
  const won = input.direction === 'OVER' ? roll > input.target : roll < input.target;
  return {
    roll,
    direction: input.direction,
    target: input.target,
    winChanceBp,
    multiplierBp,
    won,
    payoutMinor: won ? dicePayoutMinor(input.stakeMinor, multiplierBp) : 0n,
  };
}
