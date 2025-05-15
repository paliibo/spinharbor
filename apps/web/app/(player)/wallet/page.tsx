'use client';
import { ArrowRight, Receipt } from 'lucide-react';
import Link from 'next/link';
import { RequireAuth } from '@/components/layout/require-auth';
import { TransactionsTable } from '@/components/player/transactions-table';
import { BalanceCard, LedgerExplainer, ResetWalletButton, WalletStats } from '@/components/player/wallet-cards';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useTransactions, useWallet, useWalletSummary } from '@/features/wallet/use-wallet';
import { errorMessage } from '@/lib/api';

export default function WalletPage() {
  return (
    <RequireAuth>
      <Wallet />
    </RequireAuth>
  );
}

function Wallet() {
  useWallet(); // keeps the live socket subscription active on this page
  const summary = useWalletSummary();
  const tx = useTransactions({ page: 1, pageSize: 10 });
  return (
    <div className="space-y-8">
      <div>
        <PageHeader eyebrow="Account" title="Wallet" description="Demo credits with a real double-entry ledger behind them. Nothing here can be deposited or withdrawn." actions={<ResetWalletButton />} />
        {summary.isError ? <EmptyState title="Could not load wallet" description={errorMessage(summary.error)} /> : <BalanceCard summary={summary.data} loading={summary.isLoading} />}
      </div>
      <WalletStats summary={summary.data} loading={summary.isLoading} />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Receipt className="size-5 text-violet" /> Latest transactions
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/wallet/transactions">
              Full history <ArrowRight />
            </Link>
          </Button>
        </div>
        {tx.isError ? <EmptyState title="Could not load transactions" description={errorMessage(tx.error)} /> : !tx.isLoading && (tx.data?.items.length ?? 0) === 0 ? <EmptyState title="No transactions yet" description="Your initial funding and every round will be listed here." className="py-8" /> : <TransactionsTable items={tx.data?.items} loading={tx.isLoading} compact />}
      </section>
      <LedgerExplainer />
    </div>
  );
}
