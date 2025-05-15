import type { Rng } from '@spinharbor/engines';
import type { CasinoGame, GameEngine } from '@spinharbor/database';

/**
 * Aggregator-side provider contract ("seamless wallet" model).
 *
 * SpinHarbor keeps the wallet, round identity and settlement authoritative inside the platform;
 * a provider is responsible for producing the game outcome for a round and for its own session
 * bookkeeping. The platform never trusts a provider (or the client) to move money directly.
 */
export interface CreateSessionInput {
  userId: string;
  game: CasinoGame;
  /** Platform-side session id the provider can use to correlate. */
  platformSessionId: string;
}

export interface ProviderSession {
  /** Opaque token the client presents on every round. */
  token: string;
  providerCode: string;
  expiresAt: Date;
}

export interface PlayRoundInput {
  engine: GameEngine;
  roundId: string;
  stakeMinor: bigint;
  /** Validated engine-specific input (dice direction/target, roulette bets, …). */
  input: Record<string, unknown>;
  rng: Rng;
}

export interface RoundResult {
  roundId: string;
  payoutMinor: bigint;
  /** Engine specific, persisted as JSON on the round. */
  result: Record<string, unknown>;
}

export interface CasinoGameProvider {
  readonly code: string;
  createSession(input: CreateSessionInput): Promise<ProviderSession>;
  validateSession(token: string): Promise<boolean>;
  playRound(input: PlayRoundInput): Promise<RoundResult>;
  getRound(roundId: string): Promise<RoundResult | null>;
  closeSession(token: string): Promise<void>;
}
