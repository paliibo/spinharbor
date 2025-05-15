'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GameCategoryDto, GameDetailDto, GameListQuery, GameSummaryDto, Paginated, ProviderSummaryDto, PromotionDto } from '@spinharbor/contracts';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '../auth/auth-store';

export interface HomeSections {
  featured: GameSummaryDto[];
  popular: GameSummaryDto[];
  newest: GameSummaryDto[];
  recent: GameSummaryDto[];
  recommended: GameSummaryDto[];
}

export const useHome = () => {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: [...qk.home, user?.id ?? 'anon'], queryFn: () => apiGet<HomeSections>('/casino/home'), staleTime: 30_000 });
};
export const useGames = (q: Partial<GameListQuery>) => {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: [...qk.games(q), user?.id ?? 'anon'], queryFn: () => apiGet<Paginated<GameSummaryDto>>('/casino/games', q as Record<string, string | number | boolean | undefined>), placeholderData: (p) => p, staleTime: 30_000 });
};
export const useGame = (slug: string) => {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: [...qk.game(slug), user?.id ?? 'anon'], queryFn: () => apiGet<GameDetailDto>(`/casino/games/${slug}`), enabled: !!slug });
};
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => apiGet<GameCategoryDto[]>('/casino/categories'), staleTime: 5 * 60_000 });
export const useProviders = () => useQuery({ queryKey: qk.providers, queryFn: () => apiGet<ProviderSummaryDto[]>('/casino/providers'), staleTime: 5 * 60_000 });
export const usePromotions = () => useQuery({ queryKey: qk.promotions, queryFn: () => apiGet<PromotionDto[]>('/promotions'), staleTime: 5 * 60_000 });
export const useFavorites = () => {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.favorites, queryFn: () => apiGet<GameSummaryDto[]>('/casino/favorites'), enabled: !!user });
};
export const useRecent = () => {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.recent, queryFn: () => apiGet<GameSummaryDto[]>('/casino/recent'), enabled: !!user });
};

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => apiPost<{ isFavorite: boolean }>(`/casino/favorites/${slug}/toggle`),
    onSuccess: (res, slug) => {
      // Patch every cached list containing the game so hearts flip instantly everywhere.
      qc.setQueriesData<unknown>({ queryKey: ['casino'] }, (old: any) => patchFavorite(old, slug, res.isFavorite));
      qc.invalidateQueries({ queryKey: qk.favorites });
    },
  });
}

function patchFavorite(data: any, slug: string, isFavorite: boolean): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map((g) => (g && g.slug === slug ? { ...g, isFavorite } : g));
  if (typeof data === 'object') {
    if (data.slug === slug) return { ...data, isFavorite };
    const out: any = {};
    for (const [k, v] of Object.entries(data)) out[k] = Array.isArray(v) || (v && typeof v === 'object') ? patchFavorite(v, slug, isFavorite) : v;
    return out;
  }
  return data;
}
