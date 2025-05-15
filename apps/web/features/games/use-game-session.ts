'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DiceRoundResult,
  GameEngine,
  GameRoundDto,
  GameSessionDto,
  Paginated,
  PlayRoundResponse,
  RouletteBet,
  RouletteRoundResult,
  SlotsRoundResult,
} from '@spinharbor/contracts';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { newIdempotencyKey } from '@/lib/utils';
import { useApplyWallet } from '@/features/wallet/use-wallet';
import { gameErrorMessage } from './errors';

export interface SessionStatsDto {
  rounds: number;
  wins: number;
  losses: number;
  stakedMinor: number;
  paidMinor: number;
  netMinor: number;
  biggestWinMinor: number;
}

/**
 * Opens (or resumes) the active session for a game. The POST is idempotent server-side, so it is
 * safe to model as a query: the result is cached under qk.session(slug) and never refetched automatically.
 */
export function useGameSession(slug: string) {
  return useQuery({
    queryKey: qk.session(slug),
    queryFn: () => apiPost<GameSessionDto>('/games/sessions', { gameSlug: slug }),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useSessionStats(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.sessionStats(sessionId ?? ''),
    queryFn: () => apiGet<SessionStatsDto>(`/games/sessions/${sessionId}/stats`),
    enabled: !!sessionId,
    staleTime: 5_000,
  });
}

export function useRoundHistory(engine: GameEngine, pageSize = 20) {
  const q = { engine, pageSize };
  return useQuery({
    queryKey: qk.rounds(q),
    queryFn: () => apiGet<Paginated<GameRoundDto>>('/games/rounds', q),
    staleTime: 10_000,
  });
}

/** Shared plumbing for the request/response game endpoints. */
function usePlayMutation<TInput extends object, TResult>(path: string, prefix: string) {
  const qc = useQueryClient();
  const applyWallet = useApplyWallet();
  return useMutation({
    mutationFn: (input: TInput & { sessionId: string }) =>
      apiPost<PlayRoundResponse<TResult>>(path, { ...input, idempotencyKey: newIdempotencyKey(prefix) }),
    onSuccess: (res, vars) => {
      applyWallet(res.wallet);
      qc.invalidateQueries({ queryKey: qk.sessionStats(vars.sessionId) });
      qc.invalidateQueries({ queryKey: ['rounds'] });
      if (res.loyaltyPointsAwarded > 0) qc.invalidateQueries({ queryKey: qk.loyalty });
    },
    onError: (e) => {
      toast.error(gameErrorMessage(e));
    },
  });
}

export function usePlaySlots() {
  return usePlayMutation<{ betMinor: number }, SlotsRoundResult>('/games/slots/play', 'slots');
}

export function usePlayDice() {
  return usePlayMutation<{ betMinor: number; direction: 'OVER' | 'UNDER'; target: number }, DiceRoundResult>('/games/dice/play', 'dice');
}

export function usePlayRoulette() {
  return usePlayMutation<{ bets: RouletteBet[] }, RouletteRoundResult>('/games/roulette/play', 'roulette');
}
