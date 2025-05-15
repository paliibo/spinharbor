'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUserDto, ChangePasswordInput, UpdateProfileInput } from '@spinharbor/contracts';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/features/auth/auth-store';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => apiPatch<AuthUserDto>('/users/me/profile', input),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(qk.me, user);
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => apiPost<{ ok: boolean }>('/users/me/password', input) });
}

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.notifications, queryFn: () => apiGet<{ items: NotificationDto[]; unread: number }>('/notifications'), enabled: !!user, staleTime: 15_000 });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => apiPost<{ ok: boolean }>(id ? `/notifications/${id}/read` : '/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}
