'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Ban, CheckCircle2, Coins, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar, Progress, Skeleton } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_RANK, useAdjustWallet, useAdminPlayer, useAdminRounds, useAdminSessions, useAdminTransactions, useReconcilePlayer, useStaffRole, useUpdatePlayerStatus, type AdminPlayerDetail, type AdminRiskFlag } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { credits, creditsToMinor } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog } from '@/components/admin/reason-dialog';
import { RiskReviewDialog } from '@/components/admin/risk-review-dialog';
import { BoolIcon, CollapsibleJson, DescriptionList, ErrorCard, Field, KpiTile, Money, RoleBadge, Section, ShortId, StatusBadge, TimeCell } from '@/components/admin/shared';
import { RoundsTable, SessionsTable, TransactionsTable } from '@/components/admin/tables';

type StatusAction = 'SUSPENDED' | 'ACTIVE' | 'CLOSED';
const ACTION_COPY: Record<StatusAction, { title: string; description: string; label: string; variant: 'danger' | 'success' | 'primary' }> = {
  SUSPENDED: { title: 'Suspend account', description: 'The player is logged out everywhere, open game sessions are closed and they cannot play until reactivated.', label: 'Suspend', variant: 'danger' },
  ACTIVE: { title: 'Reactivate account', description: 'Restores full access. Any cooling-off or self-exclusion window is cleared.', label: 'Reactivate', variant: 'success' },
  CLOSED: { title: 'Close account', description: 'Marks the account as closed. This is a terminal state in the demo; the ledger history is preserved.', label: 'Close account', variant: 'danger' },
};

const AdjustSchema = z.object({
  amount: z.number({ error: 'Enter an amount in credits' }).refine((v) => Number.isFinite(v) && v !== 0, 'Amount must be non-zero').refine((v) => Math.abs(v) <= 1_000_000, 'Max 1,000,000 credits per adjustment'),
  reason: z.string().trim().min(3, 'At least 3 characters').max(300),
});
type AdjustForm = z.infer<typeof AdjustSchema>;

function AdjustDialog({ player, open, onOpenChange }: { player: AdminPlayerDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const adjust = useAdjustWallet(player.id);
  const form = useForm<AdjustForm>({ resolver: zodResolver(AdjustSchema), defaultValues: { reason: '' } });
  const amount = form.watch('amount');
  const preview = Number.isFinite(amount) ? creditsToMinor(amount) : 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset({ reason: '' });
        onOpenChange(o);
      }}
    >
      <DialogContent data-testid="adjust-balance-dialog">
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            adjust
              .mutateAsync({ amountMinor: creditsToMinor(v.amount), reason: v.reason })
              .then((r) => {
                toast.success('Balance adjusted', { description: `New balance ${credits(r.wallet.balanceMinor)} · entry ${r.entryId?.slice(0, 8)}` });
                onOpenChange(false);
                form.reset({ reason: '' });
              })
              .catch((e) => toast.error(errorMessage(e))),
          )}
        >
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>Posts an audited ADJUSTMENT journal entry against the player&apos;s cash account. Negative amounts debit the player.</DialogDescription>
          </DialogHeader>
          <Field label="Amount (credits, signed)" error={form.formState.errors.amount?.message} hint={`Current balance ${credits(player.wallet?.balanceMinor)} → after ${credits((player.wallet?.balanceMinor ?? 0) + preview)} (${preview} minor units)`}>
            <Input type="number" step="0.01" placeholder="e.g. 250 or -50.5" {...form.register('amount', { valueAsNumber: true })} data-testid="adjust-amount" autoFocus />
          </Field>
          <Field label="Reason" error={form.formState.errors.reason?.message}>
            <Textarea {...form.register('reason')} placeholder="Goodwill credit after outage…" data-testid="adjust-reason" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" loading={adjust.isPending} data-testid="adjust-confirm">
              Post adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const LIMIT_LABEL: Record<string, string> = { DAILY_WAGER: 'Daily wager', WEEKLY_WAGER: 'Weekly wager', DAILY_LOSS: 'Daily loss', DAILY_TOPUP: 'Daily top-up', SESSION_MINUTES: 'Session minutes' };

function OverviewTab({ p }: { p: AdminPlayerDetail }) {
  const [check, setCheck] = useState(false);
  const rec = useReconcilePlayer(p.id, check);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Profile">
        <DescriptionList
          items={[
            { label: 'Display name', value: p.profile?.displayName },
            { label: 'Country', value: p.profile?.country },
            { label: 'Avatar seed', value: <span className="font-mono text-xs">{p.profile?.avatarSeed}</span> },
            { label: 'Sound', value: <BoolIcon value={!!p.profile?.soundEnabled} trueLabel="On" falseLabel="Off" /> },
            { label: 'Session reminder', value: p.profile ? `${p.profile.sessionReminderMinutes} min` : null },
            { label: 'Registered', value: formatDate(p.createdAt) },
            { label: 'Last login', value: p.lastLoginAt ? formatDate(p.lastLoginAt) : null },
            { label: 'Last round', value: p.stats.lastRoundAt ? formatDate(p.stats.lastRoundAt) : null },
            { label: 'User id', value: <ShortId id={p.id} chars={36} /> },
          ]}
        />
      </Section>
      <div className="space-y-4">
        <Section title="Account status">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            {p.statusUntil && (
              <span className="text-xs text-muted">
                until {formatDate(p.statusUntil)} (<TimeCell iso={p.statusUntil} />)
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{p.statusReason ? <>Reason: <span className="text-text">{p.statusReason}</span></> : 'No status reason recorded.'}</p>
        </Section>
        <Section title="Responsible-gaming limits" description="Set by the player; usage is derived from today's rounds and top-ups.">
          {p.limits.length === 0 ? (
            <p className="text-sm text-muted-2">No limits configured.</p>
          ) : (
            <ul className="space-y-3">
              {p.limits.map((l) => {
                const money = l.type !== 'SESSION_MINUTES';
                const pct = l.value ? Math.min(100, Math.round((l.usedToday / l.value) * 100)) : 0;
                return (
                  <li key={l.type}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{LIMIT_LABEL[l.type] ?? l.type}</span>
                      <span className="tabular text-muted">
                        {money ? `${credits(l.usedToday)} / ${credits(l.value)}` : `${l.usedToday} / ${l.value} min`} · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} indicatorClassName={pct >= 100 ? 'from-danger to-danger' : pct >= 80 ? 'from-warning to-warning' : undefined} />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section
          title="Ledger reconciliation"
          description="Re-derives the wallet from journal lines."
          actions={
            <Button size="sm" variant="outline" onClick={() => (check ? rec.refetch() : setCheck(true))} loading={rec.isFetching}>
              <RefreshCw /> Run check
            </Button>
          }
        >
          {!check ? (
            <p className="text-sm text-muted-2">
              Cached result: {p.wallet?.reconciled === null || p.wallet === null ? '—' : p.wallet.reconciled ? <span className="text-success">reconciled</span> : <span className="text-danger">mismatch</span>}
            </p>
          ) : rec.isError ? (
            <ErrorCard error={rec.error} />
          ) : rec.data ? (
            <div className="grid grid-cols-2 gap-3 text-sm" data-testid="reconcile-result">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Cash wallet / ledger</p>
                <p className="tabular">
                  {credits(rec.data.walletCashMinor)} / {credits(rec.data.ledgerCashMinor)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Bonus wallet / ledger</p>
                <p className="tabular">
                  {credits(rec.data.walletBonusMinor)} / {credits(rec.data.ledgerBonusMinor)}
                </p>
              </div>
              <div className="col-span-2">
                <Badge variant={rec.data.ok ? 'success' : 'danger'}>{rec.data.ok ? 'Reconciled ✓' : 'Mismatch detected'}</Badge>
              </div>
            </div>
          ) : (
            <Skeleton className="h-16" />
          )}
        </Section>
      </div>
    </div>
  );
}

export default function AdminPlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAdminPlayer(id);
  const { user: me, rank, isOperator, isAdmin } = useStaffRole();
  const status = useUpdatePlayerStatus(id);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reviewFlag, setReviewFlag] = useState<AdminRiskFlag | null>(null);
  const [sessPage, setSessPage] = useState(1);
  const [roundPage, setRoundPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const sessions = useAdminSessions({ userId: id, page: sessPage, pageSize: 20 });
  const rounds = useAdminRounds({ userId: id, page: roundPage, pageSize: 20 });
  const txs = useAdminTransactions({ userId: id, page: txPage, pageSize: 20 });

  if (q.isPending)
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError) return <ErrorCard error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  const canModify = isOperator && me?.id !== p.id && ROLE_RANK[p.role] < rank;
  const modifyHint = !isOperator ? 'Requires OPERATOR role' : me?.id === p.id ? 'You cannot change your own account' : ROLE_RANK[p.role] >= rank ? 'Target role is equal or higher than yours' : undefined;

  const runStatus = (reason: string) =>
    action
      ? status
          .mutateAsync({ status: action, reason })
          .then(() => {
            toast.success(`Account ${action.toLowerCase()}`);
            setAction(null);
          })
          .catch((e) => toast.error(errorMessage(e)))
      : undefined;

  return (
    <div className="space-y-5" data-testid="admin-player-detail">
      <Link href="/admin/players" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> All players
      </Link>

      {/* Header */}
      <div className="card-surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar seed={p.profile?.avatarSeed ?? p.username} name={p.profile?.displayName ?? p.username} size={52} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{p.username}</h1>
              <RoleBadge role={p.role} />
              <StatusBadge status={p.status} />
              {p.wallet?.reconciled === false && <Badge variant="danger">ledger mismatch</Badge>}
            </div>
            <p className="text-sm text-muted">
              {p.profile?.displayName} · {p.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" title={modifyHint}>
          {p.status !== 'SUSPENDED' && p.status !== 'CLOSED' && (
            <Button variant="danger" size="sm" disabled={!canModify} onClick={() => setAction('SUSPENDED')} data-testid="player-suspend">
              <Ban /> Suspend
            </Button>
          )}
          {p.status !== 'ACTIVE' && (
            <Button variant="success" size="sm" disabled={!canModify} onClick={() => setAction('ACTIVE')} data-testid="player-reactivate">
              <CheckCircle2 /> Reactivate
            </Button>
          )}
          {p.status !== 'CLOSED' && (
            <Button variant="outline" size="sm" disabled={!canModify} onClick={() => setAction('CLOSED')} data-testid="player-close">
              <XCircle /> Close
            </Button>
          )}
          {isAdmin && p.wallet && (
            <Button variant="gold" size="sm" onClick={() => setAdjustOpen(true)} data-testid="player-adjust">
              <Coins /> Adjust balance
            </Button>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiTile label="Balance" value={credits(p.wallet?.balanceMinor)} tone="gold" hint={p.wallet ? `v${p.wallet.version}` : 'no wallet'} />
        <KpiTile label="Bonus" value={credits(p.wallet?.bonusBalanceMinor)} tone="purple" />
        <KpiTile label="Reconciled" value={p.wallet?.reconciled === null || !p.wallet ? '—' : p.wallet.reconciled ? '✓' : '✗'} tone={p.wallet?.reconciled ? 'success' : p.wallet?.reconciled === false ? 'danger' : 'default'} />
        <KpiTile label="Tier" value={p.loyalty?.tier ?? '—'} hint={p.loyalty ? `${p.loyalty.points.toLocaleString()} pts · ${p.loyalty.lifetimePoints.toLocaleString()} lifetime` : undefined} tone="gold" />
        <KpiTile label="Rounds" value={p.stats.rounds.toLocaleString()} hint={`${p.stats.activeSessions} active session(s)`} />
        <KpiTile label="Staked" value={credits(p.stats.stakedMinor, { compact: true })} />
        <KpiTile label="Payout" value={credits(p.stats.payoutMinor, { compact: true })} />
        <KpiTile label="GGR" value={credits(p.stats.ggrMinor, { sign: true, compact: true })} tone={p.stats.ggrMinor < 0 ? 'danger' : 'success'} hint={p.stats.ggrMinor < 0 ? 'player is up' : 'house is up'} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="bonuses">Bonuses ({p.bonuses.length})</TabsTrigger>
          <TabsTrigger value="risk" className={cn(p.riskFlags.some((f) => f.status === 'OPEN') && 'text-warning')}>
            Risk flags ({p.riskFlags.length})
          </TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab p={p} />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionsTable query={sessions} page={sessPage} onPage={setSessPage} showUser={false} />
        </TabsContent>
        <TabsContent value="rounds">
          <RoundsTable query={rounds} page={roundPage} onPage={setRoundPage} showUser={false} />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTable query={txs} page={txPage} onPage={setTxPage} showUser={false} />
        </TabsContent>
        <TabsContent value="bonuses">
          {p.bonuses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No bonus claims.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Bonus</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Wagering</TH>
                  <TH>Claimed</TH>
                  <TH>Expires</TH>
                </TR>
              </THead>
              <TBody>
                {p.bonuses.map((b) => {
                  const pct = b.wageringRequiredMinor ? Math.min(100, Math.round((b.wageringProgressMinor / b.wageringRequiredMinor) * 100)) : 100;
                  return (
                    <TR key={b.id}>
                      <TD>
                        <span className="font-medium">{b.name}</span> <span className="font-mono text-[11px] text-muted-2">{b.code}</span>
                      </TD>
                      <TD>
                        <StatusBadge status={b.status} />
                      </TD>
                      <TD className="text-right">
                        <Money minor={b.amountMinor} />
                      </TD>
                      <TD className="min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5" />
                          <span className="tabular text-[11px] text-muted">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-muted-2">
                          {credits(b.wageringProgressMinor)} / {credits(b.wageringRequiredMinor)}
                        </p>
                      </TD>
                      <TD>
                        <TimeCell iso={b.claimedAt} />
                      </TD>
                      <TD>
                        <TimeCell iso={b.expiresAt} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </TabsContent>
        <TabsContent value="risk">
          {p.riskFlags.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No risk flags for this player.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Description</TH>
                  <TH>Raised</TH>
                  <TH>Review</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {p.riskFlags.map((f) => (
                  <TR key={f.id}>
                    <TD className="font-mono text-xs">{f.code}</TD>
                    <TD>
                      <StatusBadge status={f.severity} />
                    </TD>
                    <TD>
                      <StatusBadge status={f.status} />
                    </TD>
                    <TD>
                      {f.description}
                      <CollapsibleJson value={f.metadata} />
                    </TD>
                    <TD>
                      <TimeCell iso={f.createdAt} />
                    </TD>
                    <TD className="text-xs text-muted">{f.reviewedBy ? <>{f.reviewedBy}: {f.resolution}</> : '—'}</TD>
                    <TD className="text-right">
                      {f.status === 'OPEN' && isOperator && (
                        <Button size="sm" variant="outline" onClick={() => setReviewFlag(f)}>
                          <ShieldAlert /> Review
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </TabsContent>
        <TabsContent value="audit">
          {p.audit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No audit entries reference this account.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Action</TH>
                  <TH>Actor</TH>
                  <TH>Target</TH>
                  <TH>Metadata</TH>
                  <TH>Time</TH>
                </TR>
              </THead>
              <TBody>
                {p.audit.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-xs">{a.action}</TD>
                    <TD>{a.actor}</TD>
                    <TD className="text-xs text-muted">
                      {a.targetType} {a.targetId && <ShortId id={a.targetId} />}
                    </TD>
                    <TD>
                      <CollapsibleJson value={a.metadata} />
                    </TD>
                    <TD>
                      <TimeCell iso={a.createdAt} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {action && <ReasonDialog open={!!action} onOpenChange={(o) => !o && setAction(null)} title={ACTION_COPY[action].title} description={ACTION_COPY[action].description} confirmLabel={ACTION_COPY[action].label} variant={ACTION_COPY[action].variant} pending={status.isPending} onConfirm={runStatus} testId="player-status-dialog" />}
      {isAdmin && <AdjustDialog player={p} open={adjustOpen} onOpenChange={setAdjustOpen} />}
      <RiskReviewDialog flag={reviewFlag} onOpenChange={(o) => !o && setReviewFlag(null)} />
    </div>
  );
}
