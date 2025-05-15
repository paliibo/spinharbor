'use client';
import { JournalEntryTypes } from '@spinharbor/contracts';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminTransactions } from '@/features/admin/use-admin';
import { Field, FilterBar, usePagedFilters } from '@/components/admin/shared';
import { TransactionsTable } from '@/components/admin/tables';

const ALL = '__all__';

export default function AdminTransactionsPage() {
  const { filters, page, setFilter, setPage } = usePagedFilters({ type: ALL, userId: '', referenceId: '' });
  const q = useAdminTransactions({ type: filters.type === ALL ? undefined : filters.type, userId: filters.userId.trim(), referenceId: filters.referenceId.trim(), page, pageSize: 25 });
  return (
    <div>
      <PageHeader eyebrow="Ledger" title="Transactions" description="Journal entries from the double-entry ledger. Each entry's lines sum to zero; open one to verify." actions={q.data && <Badge variant="outline">{q.data.total.toLocaleString()} entries</Badge>} />
      <FilterBar>
        <Field label="Type" className="min-w-[200px]">
          <Select value={filters.type} onValueChange={(v) => setFilter('type', v)}>
            <SelectTrigger data-testid="transactions-type-filter">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {JournalEntryTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="User id" className="min-w-[260px]">
          <Input value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} placeholder="uuid" className="font-mono text-xs" data-testid="transactions-user-filter" />
        </Field>
        <Field label="Reference id" className="min-w-[260px]">
          <Input value={filters.referenceId} onChange={(e) => setFilter('referenceId', e.target.value)} placeholder="round / bonus id" className="font-mono text-xs" data-testid="transactions-reference-filter" />
        </Field>
      </FilterBar>
      <TransactionsTable query={q} page={page} onPage={setPage} />
    </div>
  );
}
