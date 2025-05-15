'use client';
import { useQuery } from '@tanstack/react-query';
import type { LoyaltyStatusDto, LoyaltyTier } from '@spinharbor/contracts';
import { apiGet } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/features/auth/auth-store';

export function useLoyalty() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.loyalty, queryFn: () => apiGet<LoyaltyStatusDto>('/loyalty'), enabled: !!user, staleTime: 30_000 });
}

/** Tier → accent colour used consistently across tier badges, ladders and progress bars. */
export const tierTone: Record<LoyaltyTier, { text: string; bg: string; ring: string; label: string }> = {
  BRONZE: { text: 'text-[#d99a6c]', bg: 'bg-[#d99a6c]/15', ring: 'border-[#d99a6c]/40', label: 'Bronze' },
  SILVER: { text: 'text-[#c9cbd6]', bg: 'bg-[#c9cbd6]/15', ring: 'border-[#c9cbd6]/40', label: 'Silver' },
  GOLD: { text: 'text-gold-2', bg: 'bg-gold/15', ring: 'border-gold/40', label: 'Gold' },
  PLATINUM: { text: 'text-cyan', bg: 'bg-cyan/10', ring: 'border-cyan/40', label: 'Platinum' },
};
