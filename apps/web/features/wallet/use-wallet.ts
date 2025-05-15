'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated, TransactionDto, WalletDto, WalletSummaryDto } from '@spinharbor/contracts';
import { useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { getSocket } from '@/lib/socket';
import { newIdempotencyKey } from '@/lib/utils';
import { useAuthStore } from '../auth/auth-store';

export function useWallet() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.wallet, queryFn: () => apiGet<WalletDto>('/wallet'), enabled: !!user, staleTime: 15_000 });

  // Live balance: the server pushes every committed wallet change; stale versions are ignored.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onUpdate = (p: { balanceMinor: number; bonusBalanceMinor: number; version: number; reason: string }) => {
      qc.setQueryData<WalletDto>(qk.wallet, (old) => (old && old.version > p.version ? old : { ...(old ?? { id: '', currency: 'DMC', updatedAt: '' }), ...p, updatedAt: new Date().toISOString() }));
      qc.invalidateQueries({ queryKey: ['wallet', 'summary'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    };
    socket.on('wallet:updated', onUpdate);
    return () => {
      socket.off('wallet:updated', onUpdate);
    };
  }, [user, qc]);
  return q;
}

/** Apply a wallet slice returned by a game round immediately (optimistic-free, server-provided). */
export function useApplyWallet() {
  const qc = useQueryClient();
  return (w: { balanceMinor: number; bonusBalanceMinor: number; version: number }) => {
    qc.setQueryData<WalletDto>(qk.wallet, (old) => (old && old.version > w.version ? old : { ...(old ?? { id: '', currency: 'DMC', updatedAt: '' }), ...w, updatedAt: new Date().toISOString() }));
  };
}

export function useWalletSummary() {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.walletSummary, queryFn: () => apiGet<WalletSummaryDto>('/wallet/summary'), enabled: !!user });
}

export function useTransactions(q: { page?: number; pageSize?: number; type?: string }) {
  const user = useAuthStore((s) => s.user);
  return useQuery({ queryKey: qk.transactions(q), queryFn: () => apiGet<Paginated<TransactionDto>>('/wallet/transactions', q), enabled: !!user, placeholderData: (prev) => prev });
}

export function useResetWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<WalletDto>('/wallet/reset', undefined, { headers: { 'Idempotency-Key': newIdempotencyKey('reset') } }),
    onSuccess: (w) => {
      qc.setQueryData(qk.wallet, w);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: qk.bonuses });
    },
  });
}
