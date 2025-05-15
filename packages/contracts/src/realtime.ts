import type { CrashRoundDto, CrashBetDto, CrashHistoryItem } from './games';

/** Socket.IO event contracts. Server → client events are namespaced by domain. */
export interface ServerToClientEvents {
  'wallet:updated': (p: { balanceMinor: number; bonusBalanceMinor: number; version: number; reason: string }) => void;
  'account:status': (p: { status: string; statusUntil: string | null; reason: string | null }) => void;
  'crash:state': (p: CrashRoundDto) => void;
  'crash:tick': (p: { roundId: string; multiplierBp: number; elapsedMs: number; serverTime: string }) => void;
  'crash:bet_placed': (p: { roundId: string; bet: CrashBetDto }) => void;
  'crash:cashed_out': (p: { roundId: string; bet: CrashBetDto }) => void;
  'crash:crashed': (p: { roundId: string; crashMultiplierBp: number; serverSeed: string; history: CrashHistoryItem[] }) => void;
  'round:settled': (p: { roundId: string; engine: string; gameSlug: string; stakeMinor: number; payoutMinor: number }) => void;
  'ops:activity': (p: { kind: 'round' | 'session' | 'bonus' | 'status'; summary: string; at: string; data?: unknown }) => void;
  'session:reminder': (p: { minutesPlayed: number }) => void;
}

export interface ClientToServerEvents {
  'crash:subscribe': (ack: (state: CrashRoundDto) => void) => void;
  'crash:unsubscribe': () => void;
  'ops:subscribe': (ack: (res: { ok: boolean; error?: string }) => void) => void;
}
