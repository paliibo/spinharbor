import { Errors } from '../common/errors/domain.errors';
import type { CasinoGameProvider, CreateSessionInput, PlayRoundInput, ProviderSession, RoundResult } from './casino-game-provider.interface';

/**
 * Deliberately disabled adapter standing in for a third-party integration (e.g. a seamless-wallet
 * HTTP API). It documents the integration surface without pretending to be connected.
 */
export class ExternalStubProvider implements CasinoGameProvider {
  constructor(
    readonly code: string,
    private readonly reason: string,
  ) {}
  async createSession(_input: CreateSessionInput): Promise<ProviderSession> {
    throw Errors.conflict('PROVIDER_UNAVAILABLE', `${this.code}: ${this.reason}`);
  }
  async validateSession(): Promise<boolean> {
    return false;
  }
  async playRound(_input: PlayRoundInput): Promise<RoundResult> {
    throw Errors.conflict('PROVIDER_UNAVAILABLE', `${this.code}: ${this.reason}`);
  }
  async getRound(): Promise<RoundResult | null> {
    return null;
  }
  async closeSession(): Promise<void> {}
}
