'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BonusEligibilityDto, PlayerBonusDto } from '@spinharbor/contracts';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { newIdempotencyKey } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/auth-store';

export interface ClaimBonusResult {
  bonus: PlayerBonusDto;
  wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number };
}

export function useBonuses() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.bonuses, queryFn: () => apiGet<BonusEligibilityDto[]>('/bonuses'), enabled: !!user, staleTime: 15_000 });
}

export function useBonusHistory() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.bonusHistory, queryFn: () => apiGet<PlayerBonusDto[]>('/bonuses/history'), enabled: !!user, staleTime: 15_000 });
}

/** Claims a bonus by code. Every claim carries a fresh idempotency key so retries never double-award. */
export function useClaimBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiPost<ClaimBonusResult>('/bonuses/claim', { code }, { headers: { 'Idempotency-Key': newIdempotencyKey('bonus') } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonuses'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: qk.loyalty });
    },
  });
}
