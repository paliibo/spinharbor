'use client';
import type { WalletSummaryDto } from '@spinharbor/contracts';
import { BookOpen, Coins, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton, Stat } from '@/components/ui/misc';
import { useResetWallet } from '@/features/wallet/use-wallet';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { formatDate } from '@/lib/utils';

export function BalanceCard({ summary, loading }: { summary?: WalletSummaryDto; loading?: boolean }) {
  const w = summary?.wallet;
  return (
    <section className="card-surface relative overflow-hidden p-6" data-testid="wallet-balance-card">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <Coins className="size-3.5 text-gold" /> Cash balance
          </p>
          {loading || !w ? <Skeleton className="mt-2 h-11 w-56" /> : <p className="mt-1 text-4xl font-extrabold tabular sm:text-5xl" data-testid="wallet-balance">{credits(w.balanceMinor)}</p>}
          <p className="mt-1 text-xs text-muted-2">{w ? `${w.currency} · ledger version ${w.version} · updated ${formatDate(w.updatedAt)}` : 'Demo credits'}</p>
        </div>
        <div className="rounded-lg border border-violet/30 bg-purple/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet">Bonus balance</p>
          {loading || !w ? <Skeleton className="mt-1 h-7 w-24" /> : <p className="text-xl font-bold tabular text-violet">{credits(w.bonusBalanceMinor)}</p>}
          <p className="text-[11px] text-muted-2">Released to cash once wagered</p>
        </div>
      </div>
    </section>
  );
}

export function WalletStats({ summary, loading }: { summary?: WalletSummaryDto; loading?: boolean }) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  const todayNet = summary.todayPayoutMinor - summary.todayStakedMinor;
  const lifetimeNet = summary.lifetimePayoutMinor - summary.lifetimeStakedMinor;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="wallet-stats">
      <Stat label="Staked today" value={credits(summary.todayStakedMinor)} hint={`Top-ups today ${credits(summary.todayTopupMinor)}`} />
      <Stat label="Net today" value={credits(todayNet, { sign: true })} accent={todayNet >= 0 ? 'success' : 'danger'} hint={`Paid out ${credits(summary.todayPayoutMinor)}`} />
      <Stat label="Lifetime staked" value={credits(summary.lifetimeStakedMinor)} hint={`${summary.roundsPlayed.toLocaleString()} rounds`} />
      <Stat label="Lifetime net" value={credits(lifetimeNet, { sign: true })} accent={lifetimeNet >= 0 ? 'success' : 'danger'} hint={`Paid out ${credits(summary.lifetimePayoutMinor)}`} />
    </div>
  );
}

export function ResetWalletButton() {
  const [open, setOpen] = useState(false);
  const reset = useResetWallet();
  const onConfirm = () =>
    reset
      .mutateAsync()
      .then((w) => {
        toast.success('Demo balance restored', { description: `Cash balance is now ${credits(w.balanceMinor)}.` });
        setOpen(false);
      })
      .catch((e) => toast.error('Reset failed', { description: errorMessage(e) }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="reset-wallet">
        <RefreshCw /> Reset demo balance
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset demo balance to 10,000?</DialogTitle>
          <DialogDescription>This writes a DEMO_RESET journal entry that brings your cash balance back to 10,000.00 credits. Active bonuses and wagering progress are forfeited, and the reset counts towards your daily top-up limit.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="gold" loading={reset.isPending} onClick={onConfirm} data-testid="reset-wallet-confirm">
            Reset balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LedgerExplainer() {
  return (
    <section className="card-surface p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <BookOpen className="size-4 text-violet" /> How the ledger works
      </h2>
      <p className="mt-2 text-sm text-muted">Your wallet is not a mutable number. Every change is a double-entry journal: a stake debits your cash account and credits the house, a payout does the reverse, in one atomic transaction with the round result. The balance you see is the running sum, and the version counter guards against stale socket updates.</p>
      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        {[
          ['STAKE / PAYOUT', 'Game rounds – always paired with a round id.'],
          ['BONUS_AWARD / RELEASE', 'Bonus credited, then moved to cash once wagered.'],
          ['BONUS_FORFEIT', 'Unmet wagering when a bonus expires or on reset.'],
          ['DEMO_RESET', 'Balance restored to 10,000 on request.'],
          ['LOYALTY_REWARD', 'Milestone credits when you reach a new tier.'],
          ['ADJUSTMENT / REVERSAL', 'Operator corrections, always audited.'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-surface px-3 py-2">
            <dt className="font-mono text-[10px] font-semibold text-violet">{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
