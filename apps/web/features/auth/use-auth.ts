'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponseDto, AuthUserDto, LoginInput, RegisterInput } from '@spinharbor/contracts';
import { useEffect } from 'react';
import { api, apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { reconnectSocket } from '@/lib/socket';
import { useAuthStore } from './auth-store';

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const q = useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await apiGet<AuthUserDto>('/auth/me');
      } catch (e: any) {
        if (e?.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
  useEffect(() => {
    if (q.isSuccess) setUser(q.data);
  }, [q.isSuccess, q.data, setUser]);
  return q;
}

export function useLogin() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: LoginInput) => apiPost<AuthResponseDto>('/auth/login', input, { noRefresh: true }),
    onSuccess: (data) => {
      setUser(data.user);
      qc.setQueryData(qk.me, data.user);
      qc.invalidateQueries();
      reconnectSocket();
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: RegisterInput) => apiPost<AuthResponseDto>('/auth/register', input, { noRefresh: true }),
    onSuccess: (data) => {
      setUser(data.user);
      qc.setQueryData(qk.me, data.user);
      qc.invalidateQueries();
      reconnectSocket();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST', noRefresh: true }).catch(() => ({ ok: true })),
    onSettled: () => {
      setUser(null);
      qc.clear();
      reconnectSocket();
    },
  });
}
