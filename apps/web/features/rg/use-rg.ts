'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerLimitType, ResponsibleGamingDto, SetLimitInput } from '@spinharbor/contracts';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/features/auth/auth-store';

export function useResponsibleGaming() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.rg, queryFn: () => apiGet<ResponsibleGamingDto>('/responsible-gaming'), enabled: !!user, staleTime: 15_000 });
}

function useInvalidateRg() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.me });
    qc.invalidateQueries({ queryKey: qk.rg });
  };
}

export function useSetLimit() {
  const invalidate = useInvalidateRg();
  return useMutation({ mutationFn: (input: SetLimitInput) => apiPut<ResponsibleGamingDto>('/responsible-gaming/limits', input), onSuccess: invalidate });
}

export function useCoolingOff() {
  const invalidate = useInvalidateRg();
  return useMutation({ mutationFn: (hours: 24 | 72 | 168) => apiPost<unknown>('/responsible-gaming/cooling-off', { hours }), onSuccess: invalidate });
}

export function useSelfExclude() {
  const invalidate = useInvalidateRg();
  return useMutation({ mutationFn: (days: 30 | 90 | 180 | null) => apiPost<unknown>('/responsible-gaming/self-exclude', { days, confirmation: 'EXCLUDE ME' }), onSuccess: invalidate });
}

export const LIMIT_META: Record<PlayerLimitType, { label: string; unit: 'credits' | 'minutes'; help: string }> = {
  DAILY_WAGER: { label: 'Daily wager limit', unit: 'credits', help: 'Maximum total stakes per calendar day (UTC).' },
  WEEKLY_WAGER: { label: 'Weekly wager limit', unit: 'credits', help: 'Maximum total stakes over a rolling 7 days.' },
  DAILY_LOSS: { label: 'Daily loss limit', unit: 'credits', help: 'Maximum net loss (stakes minus payouts) per day.' },
  DAILY_TOPUP: { label: 'Daily top-up limit', unit: 'credits', help: 'Maximum demo credits added per day via bonuses and resets.' },
  SESSION_MINUTES: { label: 'Session length limit', unit: 'minutes', help: 'Maximum continuous play before gameplay pauses.' },
};
