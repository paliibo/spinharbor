'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BonusDefinitionDto, DashboardMetricsDto, GameArtwork, GameCategoryDto, GameSummaryDto, Paginated, PromotionDto, UserRole } from '@spinharbor/contracts';
import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/features/auth/auth-store';

/* ────────────────────────── roles ────────────────────────── */

export const ROLE_RANK: Record<UserRole, number> = { PLAYER: 0, SUPPORT: 1, OPERATOR: 2, ADMIN: 3 };
export type StaffRole = 'SUPPORT' | 'OPERATOR' | 'ADMIN';

/** Current staff member's role and a `can(minRole)` predicate mirroring the API's @Roles guards. */
export function useStaffRole() {
  const user = useAuthStore((s) => s.user);
  const role: UserRole = user?.role ?? 'PLAYER';
  const rank = ROLE_RANK[role];
  return {
    user,
    role,
    rank,
    can: (min: StaffRole) => rank >= ROLE_RANK[min],
    isOperator: rank >= ROLE_RANK.OPERATOR,
    isAdmin: rank >= ROLE_RANK.ADMIN,
  };
}

/* ────────────────────────── row shapes ────────────────────────── */

export type DashboardRange = '24h' | '7d' | '30d' | '90d';
export const DASHBOARD_RANGES: DashboardRange[] = ['24h', '7d', '30d', '90d'];

export interface AdminPlayerRow {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: string;
  statusUntil: string | null;
  balanceMinor: number;
  bonusBalanceMinor: number;
  tier: string;
  openRiskFlags: number;
  rounds: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AdminPlayerQuery = {
  search?: string;
  status?: string;
  role?: string;
  sort?: 'newest' | 'oldest' | 'balance' | 'activity';
  page?: number;
  pageSize?: number;
}

export interface AdminRiskFlag {
  id: string;
  userId: string;
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED' | string;
  description: string;
  metadata: unknown;
  createdAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  resolution: string | null;
}

export interface AdminPlayerDetail {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: string;
  statusReason: string | null;
  statusUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  profile: { displayName: string; avatarSeed: string; country: string; soundEnabled: boolean; sessionReminderMinutes: number; createdAt?: string; updatedAt?: string } | null;
  wallet: { balanceMinor: number; bonusBalanceMinor: number; version: number; reconciled: boolean | null } | null;
  loyalty: { tier: string; points: number; lifetimePoints: number } | null;
  stats: { rounds: number; stakedMinor: number; payoutMinor: number; ggrMinor: number; lastRoundAt: string | null; activeSessions: number };
  limits: { type: string; value: number; usedToday: number }[];
  riskFlags: (AdminRiskFlag & { reviewedBy: string | null })[];
  bonuses: { id: string; name: string; code: string; status: string; amountMinor: number; wageringRequiredMinor: number; wageringProgressMinor: number; claimedAt: string; expiresAt: string }[];
  audit: { id: string; action: string; actor: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: string }[];
}

export interface ReconcileResult {
  userId: string;
  walletCashMinor: number;
  ledgerCashMinor: number;
  walletBonusMinor: number;
  ledgerBonusMinor: number;
  ok: boolean;
}

export interface AdminSessionRow {
  id: string;
  userId: string;
  username: string;
  game: { name: string; slug: string; engine: string };
  provider: string;
  status: string;
  startedAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  roundsCount: number;
  totalStakedMinor: number;
  totalPaidMinor: number;
}

export type AdminSessionQuery = {
  userId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminRoundTransaction {
  id: string;
  type: string;
  amountMinor: number;
  journalEntryId: string;
}

export interface AdminRoundRow {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  game: { name: string; slug: string };
  engine: string;
  status: string;
  stakeMinor: number;
  payoutMinor: number;
  bonusStakeMinor: number;
  input: unknown;
  result: unknown;
  rngSeedHash: string | null;
  createdAt: string;
  settledAt: string | null;
  transactions: AdminRoundTransaction[];
}

export type AdminRoundQuery = {
  userId?: string;
  gameSlug?: string;
  engine?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminJournalLine {
  id: string;
  account: string;
  accountName: string;
  amountMinor: number;
  balanceAfterMinor: number | null;
  userId?: string | null;
  username?: string | null;
  accountId?: string;
}

export interface AdminTransactionRow {
  id: string;
  type: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  gameName: string | null;
  userId: string | null;
  username: string | null;
  reversedById: string | null;
  reversalOfId: string | null;
  createdById: string | null;
  metadata: unknown;
  createdAt: string;
  lines: AdminJournalLine[];
}

export interface AdminTransactionDetail extends Omit<AdminTransactionRow, 'gameName' | 'userId' | 'username'> {
  idempotencyKey: string | null;
  round: { id: string; game: { name: string; slug: string }; stakeMinor: number; payoutMinor: number; status: string; result: unknown } | null;
}

export type AdminTransactionQuery = {
  userId?: string;
  type?: string;
  referenceId?: string;
  page?: number;
  pageSize?: number;
}

export interface LedgerHealth {
  journalSumMinor: number;
  balanced: boolean;
  wallets: number;
  mismatchedWallets: number;
}

export interface AdminGameRow extends GameSummaryDto {
  description: string;
  sortOrder: number;
  totalRounds: number;
  rounds7d: number;
  staked7dMinor: number;
  ggr7dMinor: number;
}

export interface AdminCategoryRow extends GameCategoryDto {
  _count?: { games: number };
}

export interface AdminProviderRow {
  id: string;
  code: string;
  name: string;
  integrationType: 'INTERNAL' | 'SEAMLESS_WALLET' | 'TRANSFER_WALLET';
  status: 'OPERATIONAL' | 'DISABLED' | 'ERROR' | 'NOT_CONFIGURED';
  description: string | null;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  errors: { id: string; message: string; context: unknown; createdAt: string }[];
  adapterLoaded: boolean;
  gameCount: number;
  sessionCount: number;
}

export interface AdminBonusDefinition extends BonusDefinitionDto {
  config: unknown;
  createdAt: string;
  updatedAt: string;
  claimCount: number;
  totalAwardedMinor: number;
}

export interface AdminBonusClaimRow {
  id: string;
  userId: string;
  definitionId: string;
  status: string;
  amountMinor: number;
  wageringRequiredMinor: number;
  wageringProgressMinor: number;
  claimedAt: string;
  expiresAt: string;
  completedAt: string | null;
  journalEntryId: string | null;
  user: { username: string };
  definition: { name: string; code: string; type: string };
}

export interface AdminPromotionRow extends Omit<PromotionDto, 'bonusCode' | 'artwork'> {
  artwork: { palette: GameArtwork['palette']; motif: string };
  sortOrder: number;
  bonusDefinitionId: string | null;
  bonusDefinition: { code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRiskFlagRow extends AdminRiskFlag {
  user: { username: string; status: string };
  reviewedBy: { username: string } | null;
}

export interface AdminAuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { username: string; role: string } | null;
}

export type AdminAuditQuery = {
  action?: string;
  actorId?: string;
  targetType?: string;
  page?: number;
  pageSize?: number;
}

export type SettingKey = 'maintenanceMode' | 'maxBetMinor' | 'crashHouseEdgeBp' | 'dailyTopupLimitMinor' | 'sessionReminderDefaultMinutes';
export interface AdminSettingRow {
  key: SettingKey;
  value: unknown;
  description: string;
  updatedAt: string | null;
  isDefault: boolean;
}

export interface OpsActivityEvent {
  id: string;
  kind: 'round' | 'session' | 'bonus' | 'status';
  summary: string;
  at: string;
  data?: unknown;
}

type Query = Record<string, string | number | boolean | undefined | null>;
const clean = (q: object): Query => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Query;

/* ────────────────────────── queries ────────────────────────── */

export const useDashboard = (range: DashboardRange) => useQuery({ queryKey: qk.admin.dashboard(range), queryFn: () => apiGet<DashboardMetricsDto>('/admin/dashboard', { range }), staleTime: 30_000, refetchInterval: 60_000 });

export const useLedgerHealth = () => useQuery({ queryKey: qk.admin.ledgerHealth, queryFn: () => apiGet<LedgerHealth>('/admin/ledger/health'), staleTime: 60_000 });

export const useAdminPlayers = (q: AdminPlayerQuery) => useQuery({ queryKey: qk.admin.players(q), queryFn: () => apiGet<Paginated<AdminPlayerRow>>('/admin/players', clean(q)), placeholderData: (p) => p });

export const useAdminPlayer = (id: string) => useQuery({ queryKey: qk.admin.player(id), queryFn: () => apiGet<AdminPlayerDetail>(`/admin/players/${id}`), enabled: !!id });

export const useReconcilePlayer = (id: string, enabled: boolean) => useQuery({ queryKey: [...qk.admin.player(id), 'reconcile'], queryFn: () => apiGet<ReconcileResult>(`/admin/players/${id}/reconcile`), enabled: !!id && enabled });

export const useAdminSessions = (q: AdminSessionQuery) => useQuery({ queryKey: qk.admin.sessions(q), queryFn: () => apiGet<Paginated<AdminSessionRow>>('/admin/sessions', clean(q)), placeholderData: (p) => p });

export const useAdminRounds = (q: AdminRoundQuery) => useQuery({ queryKey: qk.admin.rounds(q), queryFn: () => apiGet<Paginated<AdminRoundRow>>('/admin/rounds', clean(q)), placeholderData: (p) => p });

export const useAdminTransactions = (q: AdminTransactionQuery) => useQuery({ queryKey: qk.admin.transactions(q), queryFn: () => apiGet<Paginated<AdminTransactionRow>>('/admin/transactions', clean(q)), placeholderData: (p) => p });

export const useAdminTransaction = (id: string) => useQuery({ queryKey: qk.admin.transaction(id), queryFn: () => apiGet<AdminTransactionDetail>(`/admin/transactions/${id}`), enabled: !!id });

export const useAdminGames = () => useQuery({ queryKey: qk.admin.games, queryFn: () => apiGet<AdminGameRow[]>('/admin/games'), staleTime: 30_000 });

export const useAdminCategories = () => useQuery({ queryKey: qk.admin.categories, queryFn: () => apiGet<AdminCategoryRow[]>('/admin/categories'), staleTime: 60_000 });

export const useAdminProviders = () => useQuery({ queryKey: qk.admin.providers, queryFn: () => apiGet<AdminProviderRow[]>('/admin/providers'), staleTime: 30_000 });

export const useAdminBonuses = () => useQuery({ queryKey: qk.admin.bonuses, queryFn: () => apiGet<AdminBonusDefinition[]>('/admin/bonuses'), staleTime: 30_000 });

export const useAdminBonusClaims = (page: number) => useQuery({ queryKey: qk.admin.bonusClaims(page), queryFn: () => apiGet<Paginated<AdminBonusClaimRow>>('/admin/bonuses/claims', { page }), placeholderData: (p) => p });

export const useAdminPromotions = () => useQuery({ queryKey: qk.admin.promotions, queryFn: () => apiGet<AdminPromotionRow[]>('/admin/promotions'), staleTime: 30_000 });

export const useAdminRiskFlags = (q: { status?: string; page?: number }) => useQuery({ queryKey: qk.admin.risk(q), queryFn: () => apiGet<Paginated<AdminRiskFlagRow>>('/admin/risk/flags', clean(q)), placeholderData: (p) => p });

export const useAdminAudit = (q: AdminAuditQuery) => useQuery({ queryKey: qk.admin.audit(q), queryFn: () => apiGet<Paginated<AdminAuditRow>>('/admin/audit', clean(q)), placeholderData: (p) => p });

export const useAdminSettings = () => useQuery({ queryKey: qk.admin.settings, queryFn: () => apiGet<AdminSettingRow[]>('/admin/settings'), staleTime: 30_000 });

/* ────────────────────────── mutations ────────────────────────── */

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly (readonly unknown[])[]) => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useUpdatePlayerStatus(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; reason: string }) => apiPatch<AdminPlayerDetail>(`/admin/players/${id}/status`, body),
    onSuccess: () => inv(qk.admin.player(id), ['admin', 'players'], ['admin', 'audit'], ['admin', 'sessions']),
  });
}

export function useAdjustWallet(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { amountMinor: number; reason: string }) => apiPost<{ entryId: string; wallet: { balanceMinor: number; bonusBalanceMinor: number } }>(`/admin/players/${id}/wallet/adjust`, body),
    onSuccess: () => inv(qk.admin.player(id), ['admin', 'players'], ['admin', 'transactions'], ['admin', 'audit'], qk.admin.ledgerHealth, ['admin', 'dashboard']),
  });
}

export function useReverseTransaction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiPost<{ entryId: string }>(`/admin/transactions/${id}/reverse`, { reason }),
    onSuccess: (_, { id }) => inv(qk.admin.transaction(id), ['admin', 'transactions'], ['admin', 'player'], ['admin', 'players'], ['admin', 'audit'], qk.admin.ledgerHealth, ['admin', 'dashboard']),
  });
}

export function useUpdateGame() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiPatch<AdminGameRow>(`/admin/games/${id}`, body),
    onSuccess: () => inv(qk.admin.games, qk.admin.categories, ['casino'], ['admin', 'audit']),
  });
}

export function useUpsertCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { slug: string; name: string; description?: string | null; icon?: string | null; sortOrder?: number }) => apiPut<AdminCategoryRow>('/admin/categories', body),
    onSuccess: () => inv(qk.admin.categories, qk.admin.games, ['casino'], ['admin', 'audit']),
  });
}

export function useDeleteCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (slug: string) => apiDelete<{ ok: boolean }>(`/admin/categories/${slug}`),
    onSuccess: () => inv(qk.admin.categories, qk.admin.games, ['casino'], ['admin', 'audit']),
  });
}

export function useUpdateProvider() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: 'OPERATIONAL' | 'DISABLED'; config?: Record<string, unknown> }) => apiPatch<AdminProviderRow>(`/admin/providers/${id}`, body),
    onSuccess: () => inv(qk.admin.providers, qk.admin.games, ['casino'], ['admin', 'audit']),
  });
}

export function useUpdateBonus() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiPatch<AdminBonusDefinition>(`/admin/bonuses/${id}`, body),
    onSuccess: () => inv(qk.admin.bonuses, qk.bonuses, ['admin', 'audit']),
  });
}

export function useUpdatePromotion() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiPatch<AdminPromotionRow>(`/admin/promotions/${id}`, body),
    onSuccess: () => inv(qk.admin.promotions, qk.promotions, ['admin', 'audit']),
  });
}

export function useReviewRiskFlag() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'REVIEWED' | 'DISMISSED'; resolution: string }) => apiPatch<AdminRiskFlagRow>(`/admin/risk/flags/${id}`, body),
    onSuccess: () => inv(['admin', 'risk'], ['admin', 'player'], ['admin', 'players'], ['admin', 'dashboard'], ['admin', 'audit']),
  });
}

export function useUpdateSettings() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: Partial<Record<SettingKey, unknown>>) => apiPatch<AdminSettingRow[]>('/admin/settings', body),
    onSuccess: () => inv(qk.admin.settings, ['admin', 'audit']),
  });
}

/* ────────────────────────── realtime ────────────────────────── */

/** Subscribes to the staff-only ops room and keeps the latest activity events in memory. */
export function useOpsActivity(limit = 60) {
  const [events, setEvents] = useState<OpsActivityEvent[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    let seq = 0;
    const subscribe = () =>
      socket.emit('ops:subscribe', (res) => {
        setLive(res.ok);
        setError(res.ok ? null : (res.error ?? 'Subscription refused'));
      });
    const onActivity = (p: { kind: OpsActivityEvent['kind']; summary: string; at: string; data?: unknown }) => {
      seq += 1;
      setEvents((prev) => [{ ...p, id: `${p.at}-${seq}` }, ...prev].slice(0, limit));
    };
    const onDisconnect = () => setLive(false);
    socket.on('ops:activity', onActivity);
    socket.on('connect', subscribe);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) subscribe();
    return () => {
      socket.off('ops:activity', onActivity);
      socket.off('connect', subscribe);
      socket.off('disconnect', onDisconnect);
    };
  }, [limit]);
  return { events, live, error, clear: () => setEvents([]) };
}
