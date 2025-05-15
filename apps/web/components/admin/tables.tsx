'use client';
import type { Paginated } from '@spinharbor/contracts';
import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { AdminRoundRow, AdminSessionRow, AdminTransactionRow } from '@/features/admin/use-admin';
import { cn } from '@/lib/utils';
import { EngineBadge, JsonView, Money, QueryState, ShortId, StatusBadge, TimeCell, sumMinor } from './shared';

/* ────────────────────────── sessions ────────────────────────── */

export function SessionsTable({ query, page, onPage, showUser = true }: { query: UseQueryResult<Paginated<AdminSessionRow>>; page: number; onPage: (p: number) => void; showUser?: boolean }) {
  return (
    <QueryState query={query} isEmpty={(d) => d.items.length === 0}>
      {(d) => (
        <>
          <Table data-testid="admin-sessions-table">
            <THead>
              <TR>
                <TH>Session</TH>
                {showUser && <TH>Player</TH>}
                <TH>Game</TH>
                <TH>Engine</TH>
                <TH>Status</TH>
                <TH className="text-right">Rounds</TH>
                <TH className="text-right">Staked</TH>
                <TH className="text-right">Paid</TH>
                <TH>Started</TH>
                <TH>Last activity</TH>
              </TR>
            </THead>
            <TBody>
              {d.items.map((s) => (
                <TR key={s.id} data-testid="session-row">
                  <TD>
                    <ShortId id={s.id} />
                  </TD>
                  {showUser && (
                    <TD>
                      <Link href={`/admin/players/${s.userId}`} className="font-medium hover:text-violet">
                        {s.username}
                      </Link>
                    </TD>
                  )}
                  <TD>
                    <span className="font-medium">{s.game.name}</span>
                    <span className="ml-1.5 text-[11px] text-muted-2">{s.provider}</span>
                  </TD>
                  <TD>
                    <EngineBadge engine={s.game.engine} />
                  </TD>
                  <TD>
                    <StatusBadge status={s.status} />
                  </TD>
                  <TD className="text-right tabular">{s.roundsCount}</TD>
                  <TD className="text-right">
                    <Money minor={s.totalStakedMinor} />
                  </TD>
                  <TD className="text-right">
                    <Money minor={s.totalPaidMinor} />
                  </TD>
                  <TD>
                    <TimeCell iso={s.startedAt} />
                  </TD>
                  <TD>
                    <TimeCell iso={s.lastActivityAt} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={d.totalPages} onChange={onPage} />
        </>
      )}
    </QueryState>
  );
}

/* ────────────────────────── rounds ────────────────────────── */

export function RoundTransactionsList({ transactions }: { transactions: AdminRoundRow['transactions'] }) {
  if (!transactions.length) return <p className="text-xs text-muted-2">No journal entries linked (round still open or voided before settlement).</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border text-sm">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge variant={t.type === 'PAYOUT' ? 'success' : t.type === 'STAKE' ? 'purple' : 'default'}>{t.type}</Badge>
            <ShortId id={t.journalEntryId} />
          </div>
          <div className="flex items-center gap-3">
            <Money minor={t.type === 'STAKE' ? -t.amountMinor : t.amountMinor} sign colored />
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/transactions/${t.journalEntryId}`} data-testid="transaction-link">Open entry</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RoundDetailDialog({ round, onOpenChange }: { round: AdminRoundRow | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!round} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="round-detail-dialog">
        {round && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                Round <ShortId id={round.id} chars={12} className="text-base" /> <EngineBadge engine={round.engine} /> <StatusBadge status={round.status} />
              </DialogTitle>
              <DialogDescription>
                {round.game.name} · {round.username} · stake <Money minor={round.stakeMinor} /> → payout <Money minor={round.payoutMinor} colored /> · <TimeCell iso={round.createdAt} />
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Input</p>
                <JsonView value={round.input} maxHeight={260} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Result</p>
                <JsonView value={round.result} maxHeight={260} />
              </div>
            </div>
            <div className="grid gap-1 text-xs text-muted">
              <p>
                RNG seed hash: <span className="break-all font-mono text-text">{round.rngSeedHash ?? '—'}</span>
              </p>
              <p>
                Session: <ShortId id={round.sessionId} /> · Bonus stake: <Money minor={round.bonusStakeMinor} /> · Settled: {round.settledAt ? <TimeCell iso={round.settledAt} /> : '—'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Journal entries</p>
              <RoundTransactionsList transactions={round.transactions} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RoundsTable({ query, page, onPage, showUser = true }: { query: UseQueryResult<Paginated<AdminRoundRow>>; page: number; onPage: (p: number) => void; showUser?: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AdminRoundRow | null>(null);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <QueryState query={query} isEmpty={(d) => d.items.length === 0}>
      {(d) => (
        <>
          <Table data-testid="admin-rounds-table">
            <THead>
              <TR>
                <TH className="w-8" />
                <TH>Round</TH>
                {showUser && <TH>Player</TH>}
                <TH>Game</TH>
                <TH>Engine</TH>
                <TH className="text-right">Stake</TH>
                <TH className="text-right">Payout</TH>
                <TH>Status</TH>
                <TH>Time</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {d.items.map((r) => {
                const open = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <TR data-testid="round-row" data-round-id={r.id} className={cn(open && 'bg-surface-2/40')}>
                      <TD>
                        <button type="button" aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} className="rounded p-1 text-muted hover:bg-surface-3 hover:text-text focus-ring" onClick={() => toggle(r.id)} data-testid="round-expand">
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      </TD>
                      <TD>
                        <ShortId id={r.id} />
                      </TD>
                      {showUser && (
                        <TD>
                          <Link href={`/admin/players/${r.userId}`} className="font-medium hover:text-violet">
                            {r.username}
                          </Link>
                        </TD>
                      )}
                      <TD className="font-medium">{r.game.name}</TD>
                      <TD>
                        <EngineBadge engine={r.engine} />
                      </TD>
                      <TD className="text-right">
                        <Money minor={r.stakeMinor} />
                      </TD>
                      <TD className={cn('text-right', r.payoutMinor > r.stakeMinor && 'font-semibold text-success')}>
                        <Money minor={r.payoutMinor} />
                      </TD>
                      <TD>
                        <StatusBadge status={r.status} />
                      </TD>
                      <TD>
                        <TimeCell iso={r.createdAt} />
                      </TD>
                      <TD className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)} aria-label="Round details" data-testid="round-detail">
                          <Eye /> Detail
                        </Button>
                      </TD>
                    </TR>
                    {open && (
                      <TR className="bg-surface/60 hover:bg-surface/60" data-testid="round-expanded">
                        <TD colSpan={showUser ? 10 : 9} className="p-4">
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div>
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Input</p>
                              <JsonView value={r.input} maxHeight={220} />
                            </div>
                            <div>
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Result</p>
                              <JsonView value={r.result} maxHeight={220} />
                            </div>
                            <div>
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Transactions</p>
                              <RoundTransactionsList transactions={r.transactions} />
                              <p className="mt-2 break-all font-mono text-[10px] text-muted-2">seed hash {r.rngSeedHash ?? '—'}</p>
                            </div>
                          </div>
                        </TD>
                      </TR>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={d.totalPages} onChange={onPage} />
          <RoundDetailDialog round={detail} onOpenChange={(o) => !o && setDetail(null)} />
        </>
      )}
    </QueryState>
  );
}

/* ────────────────────────── transactions ────────────────────────── */

export const TX_TYPE_TONE: Record<string, 'success' | 'purple' | 'gold' | 'danger' | 'cyan' | 'warning' | 'default'> = {
  STAKE: 'purple',
  PAYOUT: 'success',
  REFUND: 'cyan',
  BONUS_AWARD: 'gold',
  BONUS_RELEASE: 'gold',
  BONUS_FORFEIT: 'danger',
  LOYALTY_REWARD: 'gold',
  ADJUSTMENT: 'warning',
  DEMO_RESET: 'cyan',
  REVERSAL: 'danger',
  INITIAL_FUNDING: 'default',
};

/** The player-facing amount of an entry: the sum of lines on player accounts. */
export function playerAmount(tx: AdminTransactionRow) {
  const player = tx.lines.filter((l) => l.account.startsWith('PLAYER'));
  return sumMinor(player.length ? player : tx.lines.filter((l) => l.amountMinor > 0));
}

export function TransactionsTable({ query, page, onPage, showUser = true }: { query: UseQueryResult<Paginated<AdminTransactionRow>>; page: number; onPage: (p: number) => void; showUser?: boolean }) {
  return (
    <QueryState query={query} isEmpty={(d) => d.items.length === 0}>
      {(d) => (
        <>
          <Table data-testid="admin-transactions-table">
            <THead>
              <TR>
                <TH>Entry</TH>
                <TH>Type</TH>
                <TH>Description</TH>
                {showUser && <TH>Player</TH>}
                <TH className="text-right">Amount</TH>
                <TH className="text-right">Balance after</TH>
                <TH>Flags</TH>
                <TH>Time</TH>
              </TR>
            </THead>
            <TBody>
              {d.items.map((t) => {
                const amount = playerAmount(t);
                const after = t.lines.find((l) => l.account === 'PLAYER_CASH')?.balanceAfterMinor ?? t.lines.find((l) => l.balanceAfterMinor !== null)?.balanceAfterMinor ?? null;
                return (
                  <TR key={t.id} data-testid="transaction-row" data-transaction-id={t.id}>
                    <TD>
                      <Link href={`/admin/transactions/${t.id}`} className="hover:text-violet" data-testid="transaction-link">
                        <ShortId id={t.id} copy={false} />
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={TX_TYPE_TONE[t.type] ?? 'default'}>{t.type.replace(/_/g, ' ')}</Badge>
                    </TD>
                    <TD>
                      <Link href={`/admin/transactions/${t.id}`} className="block max-w-[260px] truncate hover:text-violet">
                        {t.description}
                      </Link>
                      {t.gameName && <span className="text-[11px] text-muted-2">{t.gameName}</span>}
                    </TD>
                    {showUser && (
                      <TD>
                        {t.userId ? (
                          <Link href={`/admin/players/${t.userId}`} className="font-medium hover:text-violet">
                            {t.username}
                          </Link>
                        ) : (
                          <span className="text-muted-2">house</span>
                        )}
                      </TD>
                    )}
                    <TD className="text-right">
                      <Money minor={amount} sign colored className="font-semibold" />
                    </TD>
                    <TD className="text-right">
                      <Money minor={after} className="text-muted" />
                    </TD>
                    <TD className="space-x-1">
                      {t.reversedById && <Badge variant="danger">reversed</Badge>}
                      {t.reversalOfId && <Badge variant="warning">reversal</Badge>}
                      {t.createdById && <Badge variant="outline">manual</Badge>}
                    </TD>
                    <TD>
                      <TimeCell iso={t.createdAt} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={d.totalPages} onChange={onPage} />
        </>
      )}
    </QueryState>
  );
}
