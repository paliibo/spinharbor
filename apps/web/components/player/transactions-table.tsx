'use client';
import type { TransactionDto } from '@spinharbor/contracts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { credits } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';

const TYPE_VARIANT: Record<TransactionDto['type'], 'default' | 'purple' | 'gold' | 'cyan' | 'success' | 'danger' | 'warning' | 'outline'> = {
  INITIAL_FUNDING: 'cyan',
  STAKE: 'default',
  PAYOUT: 'success',
  REFUND: 'warning',
  BONUS_AWARD: 'purple',
  BONUS_RELEASE: 'purple',
  BONUS_FORFEIT: 'danger',
  LOYALTY_REWARD: 'gold',
  ADJUSTMENT: 'warning',
  DEMO_RESET: 'cyan',
  REVERSAL: 'danger',
};

export function TransactionTypeBadge({ type }: { type: TransactionDto['type'] }) {
  return <Badge variant={TYPE_VARIANT[type] ?? 'default'}>{type.replace(/_/g, ' ').toLowerCase()}</Badge>;
}

export function TransactionsTable({ items, loading, compact = false }: { items?: TransactionDto[]; loading?: boolean; compact?: boolean }) {
  return (
    <Table data-testid="transactions-table">
      <THead>
        <TR>
          <TH>Type</TH>
          <TH>Description</TH>
          {!compact && <TH>Game</TH>}
          <TH className="text-right">Amount</TH>
          <TH className="text-right">Balance after</TH>
          <TH>Account</TH>
          <TH>Date</TH>
        </TR>
      </THead>
      <TBody>
        {loading &&
          Array.from({ length: compact ? 5 : 10 }).map((_, i) => (
            <TR key={i}>
              <TD colSpan={compact ? 6 : 7}>
                <Skeleton className="h-5 w-full" />
              </TD>
            </TR>
          ))}
        {items?.map((t) => (
          <TR key={t.id} data-testid="transaction-row" data-type={t.type}>
            <TD>
              <TransactionTypeBadge type={t.type} />
            </TD>
            <TD className="max-w-[260px] truncate" title={t.description}>
              {t.description}
            </TD>
            {!compact && <TD className="text-muted">{t.gameName ?? '—'}</TD>}
            <TD className={cn('text-right tabular font-semibold', t.amountMinor > 0 ? 'text-success' : t.amountMinor < 0 ? 'text-danger' : 'text-muted')} data-testid="transaction-amount">
              {credits(t.amountMinor, { sign: true })}
            </TD>
            <TD className="text-right tabular text-muted">{t.balanceAfterMinor === null ? '—' : credits(t.balanceAfterMinor)}</TD>
            <TD>
              <span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold', t.account === 'BONUS' ? 'bg-purple/15 text-violet' : 'bg-surface-3 text-muted')}>{t.account}</span>
            </TD>
            <TD className="whitespace-nowrap text-muted">{formatDate(t.createdAt)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
