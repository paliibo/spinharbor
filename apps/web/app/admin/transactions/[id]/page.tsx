'use client';
import { ArrowLeft, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAdminTransaction, useReverseTransaction, useStaffRole } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog } from '@/components/admin/reason-dialog';
import { DescriptionList, ErrorCard, JsonView, Money, Section, ShortId, StatusBadge, sumMinor } from '@/components/admin/shared';
import { TX_TYPE_TONE } from '@/components/admin/tables';

const REVERSIBLE = new Set(['ADJUSTMENT', 'BONUS_AWARD', 'LOYALTY_REWARD']);

export default function AdminTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAdminTransaction(id);
  const { isAdmin } = useStaffRole();
  const reverse = useReverseTransaction();
  const [open, setOpen] = useState(false);

  if (q.isPending)
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
      </div>
    );
  if (q.isError) return <ErrorCard error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  const total = sumMinor(t.lines);
  const canReverse = REVERSIBLE.has(t.type) && !t.reversedById && !t.reversalOfId;

  return (
    <div className="space-y-5" data-testid="admin-transaction-detail">
      <Link href="/admin/transactions" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> All transactions
      </Link>
      <div className="card-surface flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={TX_TYPE_TONE[t.type] ?? 'default'}>{t.type.replace(/_/g, ' ')}</Badge>
            <h1 className="text-xl font-bold tracking-tight">{t.description}</h1>
            {t.reversedById && <Badge variant="danger">Reversed</Badge>}
            {t.reversalOfId && <Badge variant="warning">Reversal entry</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            Entry <ShortId id={t.id} chars={36} /> · {formatDate(t.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && canReverse && (
            <Button variant="danger" size="sm" onClick={() => setOpen(true)} data-testid="transaction-reverse">
              <Undo2 /> Reverse entry
            </Button>
          )}
          {!isAdmin && canReverse && <span className="text-xs text-muted-2">Reversal requires ADMIN</span>}
          {REVERSIBLE.has(t.type) && t.reversedById && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/transactions/${t.reversedById}`}>View reversal</Link>
            </Button>
          )}
          {t.reversalOfId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/transactions/${t.reversalOfId}`}>View original</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Journal lines" description="Double-entry: debits and credits across accounts must net to zero." className="lg:col-span-2" bodyClassName="p-0">
          <Table className="rounded-none border-0" data-testid="transaction-lines">
            <THead>
              <TR>
                <TH>Account</TH>
                <TH>User</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-right">Balance after</TH>
              </TR>
            </THead>
            <TBody>
              {t.lines.map((l) => (
                <TR key={l.id} data-testid="transaction-line">
                  <TD>
                    <span className="font-mono text-xs">{l.account}</span>
                    <p className="text-[11px] text-muted-2">{l.accountName}</p>
                  </TD>
                  <TD>
                    {l.userId ? (
                      <Link href={`/admin/players/${l.userId}`} className="font-medium hover:text-violet">
                        {l.username}
                      </Link>
                    ) : (
                      <span className="text-muted-2">house</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Money minor={l.amountMinor} sign colored className="font-semibold" />
                  </TD>
                  <TD className="text-right">
                    <Money minor={l.balanceAfterMinor} className="text-muted" />
                  </TD>
                </TR>
              ))}
              <TR className="bg-surface-2/60 font-semibold hover:bg-surface-2/60">
                <TD colSpan={2}>Σ lines</TD>
                <TD className={cn('text-right tabular', total === 0 ? 'text-success' : 'text-danger')} data-testid="transaction-sum">
                  {credits(total, { sign: true })} {total === 0 ? '✓ balanced' : '✗ unbalanced'}
                </TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </Section>

        <div className="space-y-4">
          <Section title="Entry metadata">
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                { label: 'Reference', value: t.referenceId ? <span className="text-xs">{t.referenceType} <ShortId id={t.referenceId} /></span> : null },
                { label: 'Idempotency key', value: t.idempotencyKey ? <span className="break-all font-mono text-xs">{t.idempotencyKey}</span> : null },
                { label: 'Created by', value: t.createdById ? <ShortId id={t.createdById} /> : <span className="text-muted-2">system</span> },
                { label: 'Reversal of', value: t.reversalOfId ? <Link href={`/admin/transactions/${t.reversalOfId}`} className="text-violet hover:underline"><ShortId id={t.reversalOfId} copy={false} /></Link> : null },
                { label: 'Reversed by', value: t.reversedById ? <Link href={`/admin/transactions/${t.reversedById}`} className="text-violet hover:underline"><ShortId id={t.reversedById} copy={false} /></Link> : null },
              ]}
            />
            <p className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">Metadata</p>
            <JsonView value={t.metadata} maxHeight={200} />
          </Section>

          {t.round && (
            <Section title="Related round" actions={<Button size="sm" variant="outline" asChild><Link href="/admin/rounds">All rounds</Link></Button>}>
              <DescriptionList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Round', value: <ShortId id={t.round.id} chars={36} /> },
                  { label: 'Game', value: <Link href={`/casino/games/${t.round.game.slug}`} className="hover:text-violet">{t.round.game.name}</Link> },
                  { label: 'Status', value: <StatusBadge status={t.round.status} /> },
                  { label: 'Stake / payout', value: <span className="tabular">{credits(t.round.stakeMinor)} / {credits(t.round.payoutMinor)}</span> },
                ]}
              />
              <p className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">Result</p>
              <JsonView value={t.round.result} maxHeight={200} />
            </Section>
          )}
        </div>
      </div>

      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title="Reverse this entry"
        description="Posts a compensating REVERSAL entry with the opposite lines. The original entry is kept and marked as reversed."
        confirmLabel="Post reversal"
        variant="danger"
        pending={reverse.isPending}
        testId="transaction-reverse-dialog"
        onConfirm={(reason) =>
          reverse
            .mutateAsync({ id: t.id, reason })
            .then((r) => {
              toast.success('Reversal posted', { description: r.entryId ? `Entry ${r.entryId.slice(0, 8)}` : undefined });
              setOpen(false);
            })
            .catch((e) => toast.error(errorMessage(e)))
        }
      />
    </div>
  );
}
