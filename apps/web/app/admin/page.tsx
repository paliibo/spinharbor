'use client';
import { Activity, ArrowDownRight, ArrowUpRight, Coins, Gift, Layers, ListOrdered, Scale, ShieldAlert, UserPlus, Users, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { DASHBOARD_RANGES, useDashboard, useLedgerHealth, type DashboardRange } from '@/features/admin/use-admin';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LiveFeed } from '@/components/admin/live-feed';
import { axisProps, chart, ChartTooltip, EngineBadge, ErrorCard, KpiTile, Money, Section, shortDate, StatusBadge, TimeCell } from '@/components/admin/shared';

const fmtMoney = (v: number) => credits(v);

export default function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const q = useDashboard(range);
  const health = useLedgerHealth();
  const d = q.data;

  const daily = useMemo(() => (d?.daily ?? []).map((x) => ({ ...x, label: shortDate(x.date) })), [d]);
  const engine = useMemo(() => (d?.engineSplit ?? []).map((e) => ({ name: e.engine, value: e.rounds, stakedMinor: e.stakedMinor })), [d]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Platform KPIs computed from the double-entry ledger. GGR = stakes − payouts."
        actions={
          <div className="inline-flex rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Range" data-testid="dashboard-range">
            {DASHBOARD_RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={cn('h-8 rounded-md px-3 text-xs font-semibold transition-colors focus-ring', range === r ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>
                {r}
              </button>
            ))}
          </div>
        }
      />

      {q.isError && <ErrorCard error={q.error} onRetry={() => q.refetch()} />}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="dashboard-kpis">
        {q.isPending ? (
          Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)
        ) : d ? (
          <>
            <KpiTile label="Total players" value={d.totals.players.toLocaleString()} icon={Users} />
            <KpiTile label="Active players" value={d.totals.activePlayers.toLocaleString()} hint={`in ${range}`} icon={Activity} tone="cyan" />
            <KpiTile label="New players" value={d.totals.newPlayers.toLocaleString()} hint={`in ${range}`} icon={UserPlus} tone="purple" />
            <KpiTile label="Total staked" value={credits(d.totals.totalStakedMinor, { compact: true })} icon={Coins} tone="purple" />
            <KpiTile label="Total payouts" value={credits(d.totals.totalPayoutMinor, { compact: true })} icon={ArrowUpRight} tone="gold" />
            <KpiTile label="GGR" value={credits(d.totals.ggrMinor, { sign: true })} hint={d.totals.ggrMinor < 0 ? 'House is down for this range' : 'House edge realised'} icon={d.totals.ggrMinor < 0 ? ArrowDownRight : Scale} tone={d.totals.ggrMinor < 0 ? 'danger' : 'success'} testId="kpi-ggr" />
            <KpiTile label="Rounds" value={d.totals.rounds.toLocaleString()} icon={ListOrdered} />
            <KpiTile label="Active sessions" value={d.totals.activeSessions.toLocaleString()} icon={Workflow} tone="cyan" />
            <KpiTile label="Bonus claims" value={d.totals.bonusClaims.toLocaleString()} hint={`${credits(d.totals.bonusAwardedMinor, { compact: true })} awarded`} icon={Gift} tone="gold" />
            <KpiTile label="Open risk flags" value={d.totals.openRiskFlags.toLocaleString()} icon={ShieldAlert} tone={d.totals.openRiskFlags > 0 ? 'warning' : 'default'} />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Staked vs payout" description="Daily volume in credits" className="xl:col-span-2" bodyClassName="p-3 pt-4">
          {q.isPending ? (
            <Skeleton className="h-64" />
          ) : daily.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No rounds in this range.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-staked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.staked} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={chart.staked} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-payout" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.payout} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={chart.payout} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => credits(v, { compact: true })} width={64} />
                  <RTooltip content={<ChartTooltip formatter={fmtMoney} />} cursor={{ stroke: chart.grid }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: chart.axis }} />
                  <Area type="monotone" dataKey="stakedMinor" name="Staked" stroke={chart.staked} fill="url(#g-staked)" strokeWidth={2} />
                  <Area type="monotone" dataKey="payoutMinor" name="Payout" stroke={chart.payout} fill="url(#g-payout)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
        <Section title="Daily GGR" description="Green = house profit, red = house loss" bodyClassName="p-3 pt-4">
          {q.isPending ? (
            <Skeleton className="h-64" />
          ) : daily.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No data.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => credits(v, { compact: true })} width={64} />
                  <RTooltip content={<ChartTooltip formatter={fmtMoney} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="ggrMinor" name="GGR" radius={[4, 4, 0, 0]}>
                    {daily.map((x) => (
                      <Cell key={x.date} fill={x.ggrMinor < 0 ? chart.ggrNeg : chart.ggrPos} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Top games */}
        <Section title="Top games" description="By rounds in range" className="xl:col-span-2" bodyClassName="p-0">
          {q.isPending ? (
            <div className="p-4">
              <Skeleton className="h-40" />
            </div>
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <TR>
                  <TH>Game</TH>
                  <TH className="text-right">Rounds</TH>
                  <TH className="text-right">Staked</TH>
                  <TH className="text-right">GGR</TH>
                  <TH className="text-right">Margin</TH>
                </TR>
              </THead>
              <TBody>
                {(d?.topGames ?? []).map((g) => (
                  <TR key={g.gameId}>
                    <TD>
                      <Link href={`/casino/games/${g.slug}`} className="font-medium hover:text-violet">
                        {g.name}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-muted-2">{g.slug}</span>
                    </TD>
                    <TD className="text-right tabular">{g.rounds.toLocaleString()}</TD>
                    <TD className="text-right">
                      <Money minor={g.stakedMinor} />
                    </TD>
                    <TD className="text-right">
                      <Money minor={g.ggrMinor} sign colored />
                    </TD>
                    <TD className="text-right tabular text-muted">{g.stakedMinor ? ((g.ggrMinor / g.stakedMinor) * 100).toFixed(1) + '%' : '—'}</TD>
                  </TR>
                ))}
                {d && d.topGames.length === 0 && (
                  <TR>
                    <TD colSpan={5} className="py-8 text-center text-muted">
                      No games played in this range.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          )}
        </Section>

        {/* Engine split */}
        <Section title="Engine split" description="Rounds by engine" bodyClassName="p-3">
          {q.isPending ? (
            <Skeleton className="h-56" />
          ) : engine.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No data.</p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-52 w-1/2 min-w-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={engine} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={3} stroke="none">
                      {engine.map((e, i) => (
                        <Cell key={e.name} fill={chart.series[i % chart.series.length]} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} rounds`} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2 text-xs">
                {engine.map((e, i) => {
                  const total = engine.reduce((a, x) => a + x.value, 0) || 1;
                  return (
                    <li key={e.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-2.5 rounded-sm" style={{ background: chart.series[i % chart.series.length] }} />
                        <EngineBadge engine={e.name} />
                      </span>
                      <span className="tabular text-muted">
                        {e.value.toLocaleString()} · {((e.value / total) * 100).toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent transactions */}
        <Section
          title="Recent transactions"
          description="Latest journal entries"
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/transactions">View all</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border" data-testid="recent-transactions">
            {q.isPending && (
              <li className="p-4">
                <Skeleton className="h-40" />
              </li>
            )}
            {(d?.recentTransactions ?? []).map((t) => (
              <li key={t.id}>
                <Link href={`/admin/transactions/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-surface-2/60 focus-ring">
                  <div className="min-w-0">
                    <p className="truncate">{t.description}</p>
                    <p className="text-[11px] text-muted-2">
                      <span className="font-medium text-muted">{t.username}</span> · {t.type} · <TimeCell iso={t.createdAt} />
                    </p>
                  </div>
                  <Money minor={t.amountMinor} sign colored className="shrink-0 text-sm font-semibold" />
                </Link>
              </li>
            ))}
            {d && d.recentTransactions.length === 0 && <li className="p-6 text-center text-sm text-muted">No transactions yet.</li>}
          </ul>
        </Section>

        {/* Recent bonus claims */}
        <Section
          title="Recent bonus claims"
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/bonuses">Bonuses</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {q.isPending && (
              <li className="p-4">
                <Skeleton className="h-40" />
              </li>
            )}
            {(d?.recentBonusClaims ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{b.bonusName}</p>
                  <p className="text-[11px] text-muted-2">
                    <span className="font-medium text-muted">{b.username}</span> · <TimeCell iso={b.claimedAt} />
                  </p>
                </div>
                <Badge variant="gold">+{credits(b.amountMinor)}</Badge>
              </li>
            ))}
            {d && d.recentBonusClaims.length === 0 && <li className="p-6 text-center text-sm text-muted">No claims yet.</li>}
          </ul>
        </Section>

        {/* Ledger health */}
        <Section title="Ledger health" description="Global double-entry invariant" actions={<Button size="sm" variant="ghost" onClick={() => health.refetch()} loading={health.isFetching}>Re-check</Button>}>
          {health.isPending ? (
            <Skeleton className="h-28" />
          ) : health.isError ? (
            <ErrorCard error={health.error} onRetry={() => health.refetch()} />
          ) : (
            <div className="space-y-3" data-testid="ledger-health">
              <div className={cn('flex items-center gap-3 rounded-lg border p-3', health.data.balanced && health.data.mismatchedWallets === 0 ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5')}>
                <Layers className={cn('size-5', health.data.balanced ? 'text-success' : 'text-danger')} />
                <div>
                  <p className="text-sm font-semibold">{health.data.balanced ? 'Journal balanced ✓' : 'Journal out of balance'}</p>
                  <p className="text-xs text-muted">
                    Σ lines = <span className="font-mono">{health.data.journalSumMinor}</span> minor units
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Wallets</p>
                  <p className="text-lg font-bold tabular">{health.data.wallets}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Mismatched</p>
                  <p className={cn('text-lg font-bold tabular', health.data.mismatchedWallets > 0 ? 'text-danger' : 'text-success')}>{health.data.mismatchedWallets}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-2">Every wallet balance is re-derived from its journal lines; a mismatch means a cached balance drifted from the ledger.</p>
              <Badge variant={health.data.balanced && health.data.mismatchedWallets === 0 ? 'success' : 'danger'}>{health.data.balanced && health.data.mismatchedWallets === 0 ? 'All wallets reconciled' : `${health.data.mismatchedWallets} wallet(s) need attention`}</Badge>
            </div>
          )}
        </Section>
      </div>

      <LiveFeed />
    </div>
  );
}
