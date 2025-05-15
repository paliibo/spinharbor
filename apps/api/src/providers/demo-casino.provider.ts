import { Injectable } from '@nestjs/common';
import { playDice, playRoulette, playSlots, validateRouletteBets } from '@spinharbor/engines';
import { randomBytes } from 'node:crypto';
import { Errors } from '../common/errors/domain.errors';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CasinoGameProvider, CreateSessionInput, PlayRoundInput, ProviderSession, RoundResult } from './casino-game-provider.interface';

export const DEMO_PROVIDER_CODE = 'spinharbor-studios';

/** Fully working in-process provider that runs the four SpinHarbor engines. */
@Injectable()
export class DemoCasinoProvider implements CasinoGameProvider {
  readonly code = DEMO_PROVIDER_CODE;
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<ProviderSession> {
    return { token: `demo_${randomBytes(24).toString('base64url')}`, providerCode: this.code, expiresAt: new Date(Date.now() + 12 * 3600 * 1000) };
  }

  async validateSession(token: string): Promise<boolean> {
    const s = await this.prisma.gameSession.findUnique({ where: { token }, select: { status: true } });
    return s?.status === 'ACTIVE';
  }

  async playRound(input: PlayRoundInput): Promise<RoundResult> {
    switch (input.engine) {
      case 'SLOTS': {
        const r = playSlots(input.rng, input.stakeMinor);
        const { totalWinMinor, ...result } = r;
        return { roundId: input.roundId, payoutMinor: totalWinMinor, result: { ...result } };
      }
      case 'DICE': {
        const { direction, target } = input.input as { direction: 'OVER' | 'UNDER'; target: number };
        const { payoutMinor, ...result } = playDice(input.rng, { direction, target, stakeMinor: input.stakeMinor });
        return { roundId: input.roundId, payoutMinor, result: { ...result } };
      }
      case 'ROULETTE': {
        const bets = (input.input as { bets: any[] }).bets;
        const err = validateRouletteBets(bets);
        if (err) throw Errors.badRequest('INVALID_BETS', err);
        const { totalPayoutMinorBig, totalStakeMinorBig, ...result } = playRoulette(input.rng, bets);
        if (totalStakeMinorBig !== input.stakeMinor) throw Errors.badRequest('STAKE_MISMATCH', 'Stake does not equal the sum of bets');
        return { roundId: input.roundId, payoutMinor: totalPayoutMinorBig, result: { ...result } };
      }
      default:
        throw Errors.gameUnavailable(input.engine);
    }
  }

  async getRound(roundId: string): Promise<RoundResult | null> {
    const r = await this.prisma.gameRound.findUnique({ where: { id: roundId } });
    return r ? { roundId: r.id, payoutMinor: r.payoutMinor, result: (r.result as Record<string, unknown>) ?? {} } : null;
  }

  async closeSession(_token: string): Promise<void> {
    // Nothing to release for the in-process provider.
  }
}
