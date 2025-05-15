'use client';
import { JournalEntryTypes } from '@spinharbor/contracts';
import { useState } from 'react';
import { RequireAuth } from '@/components/layout/require-auth';
import { Breadcrumb } from '@/components/player/game-detail-header';
import { TransactionsTable } from '@/components/player/transactions-table';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/table';
import { useTransactions } from '@/features/wallet/use-wallet';
import { errorMessage } from '@/lib/api';

const ALL = '__all__';
const PAGE_SIZE = 25;

export default function TransactionsPage() {
  return (
    <RequireAuth>
      <Transactions />
    </RequireAuth>
  );
}

function Transactions() {
  const [type, setType] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const tx = useTransactions({ page, pageSize: PAGE_SIZE, type: type === ALL ? undefined : type });
  const total = tx.data?.total ?? 0;
  return (
    <div>
      <Breadcrumb items={[{ label: 'Wallet', href: '/wallet' }, { label: 'Transactions' }]} />
      <PageHeader
        eyebrow="Account"
        title="Transaction history"
        description={tx.data ? `${total.toLocaleString()} journal ${total === 1 ? 'entry' : 'entries'}${type !== ALL ? ` of type ${type.replace(/_/g, ' ').toLowerCase()}` : ''}.` : 'Every ledger entry on your wallet.'}
        actions={
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52" data-testid="transaction-type-filter" aria-label="Transaction type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {JournalEntryTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ').toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {tx.isError ? (
        <EmptyState title="Could not load transactions" description={errorMessage(tx.error)} />
      ) : !tx.isLoading && total === 0 ? (
        <EmptyState title="No transactions" description={type !== ALL ? 'Nothing of this type yet – try another filter.' : 'Your ledger is empty.'} />
      ) : (
        <div className={tx.isFetching && !tx.isLoading ? 'opacity-70 transition-opacity' : ''}>
          <TransactionsTable items={tx.data?.items} loading={tx.isLoading} />
          <Pagination page={tx.data?.page ?? page} totalPages={tx.data?.totalPages ?? 1} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
