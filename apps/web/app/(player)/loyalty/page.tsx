'use client';
import { Calculator } from 'lucide-react';
import { RequireAuth } from '@/components/layout/require-auth';
import { LoyaltyTierCard, PointsHistory, TierLadder } from '@/components/player/loyalty-cards';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useLoyalty } from '@/features/loyalty/use-loyalty';
import { errorMessage } from '@/lib/api';

export default function LoyaltyPage() {
  return (
    <RequireAuth>
      <Loyalty />
    </RequireAuth>
  );
}

function Loyalty() {
  const loyalty = useLoyalty();
  const perCredit = loyalty.data?.pointsPerCreditWagered ?? 0.1;
  const creditsPerPoint = perCredit > 0 ? Math.round(1 / perCredit) : 10;

  if (loyalty.isError) return <EmptyState title="Could not load loyalty status" description={errorMessage(loyalty.error)} />;
  return (
    <div className="space-y-10">
      <div>
        <PageHeader eyebrow="Rewards" title="Loyalty" description="Every wager earns points. Lifetime points decide your tier; tiers unlock cashback rates and milestone bonuses." />
        {loyalty.isLoading || !loyalty.data ? <Skeleton className="h-56 rounded-xl" /> : <LoyaltyTierCard data={loyalty.data} />}
      </div>

      <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="card-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Calculator className="size-4 text-violet" /> How points are earned
          </h2>
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold text-text">1 point per {creditsPerPoint} credits wagered</span>, awarded when a round settles and rounded down per round. Points are never deducted for losses, and bonus-balance wagers count the same as cash.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              { stake: 10, pts: Math.floor(10 * perCredit) },
              { stake: 100, pts: Math.floor(100 * perCredit) },
              { stake: 1000, pts: Math.floor(1000 * perCredit) },
            ].map((r) => (
              <div key={r.stake} className="rounded-md border border-border bg-surface px-2 py-2">
                <p className="text-muted">Wager {r.stake.toLocaleString()}</p>
                <p className="font-bold tabular text-gold-2">+{r.pts} pts</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface p-5">
          <h2 className="text-base font-bold">Tier rules</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>· Tiers are based on <span className="text-text">lifetime</span> points and never go down.</li>
            <li>· Reaching Silver, Gold or Platinum unlocks a one-time milestone bonus under Bonuses.</li>
            <li>· Weekly cashback percentage rises with each tier.</li>
            <li>· Demo data: points reset together with the demo balance only if the operator reseeds.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">Tier ladder</h2>
        {loyalty.isLoading || !loyalty.data ? <Skeleton className="h-64 rounded-xl" /> : <TierLadder data={loyalty.data} />}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">Recent points</h2>
        {loyalty.isLoading || !loyalty.data ? <Skeleton className="h-48 rounded-xl" /> : loyalty.data.recent.length === 0 ? <EmptyState title="No points yet" description="Play a round of any original to start earning." className="py-8" /> : <PointsHistory items={loyalty.data.recent} />}
      </section>
    </div>
  );
}
