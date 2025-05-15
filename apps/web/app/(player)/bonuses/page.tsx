'use client';
import { Gift, History } from 'lucide-react';
import { RequireAuth } from '@/components/layout/require-auth';
import { ActiveBonusCard, BonusEligibilityCard, BonusHistoryTable } from '@/components/player/bonus-cards';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useBonusHistory, useBonuses } from '@/features/bonuses/use-bonuses';
import { errorMessage } from '@/lib/api';

export default function BonusesPage() {
  return (
    <RequireAuth>
      <Bonuses />
    </RequireAuth>
  );
}

function Bonuses() {
  const bonuses = useBonuses();
  const history = useBonusHistory();
  const active = history.data?.filter((b) => b.status === 'ACTIVE') ?? [];
  const eligibleCount = bonuses.data?.filter((b) => b.eligible).length ?? 0;

  return (
    <div className="space-y-10">
      <section>
        <PageHeader eyebrow="Rewards" title="Bonuses" description={bonuses.data ? `${eligibleCount} ${eligibleCount === 1 ? 'bonus is' : 'bonuses are'} claimable right now. Bonus credits need wagering before they move to cash.` : 'Claimable rewards and your bonus history.'} />
        {bonuses.isError ? (
          <EmptyState title="Could not load bonuses" description={errorMessage(bonuses.error)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bonuses.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
            {bonuses.data?.map((b) => (
              <BonusEligibilityCard key={b.definition.id} item={b} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
          <Gift className="size-5 text-violet" /> Active bonuses
        </h2>
        {history.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : active.length === 0 ? (
          <EmptyState title="No active bonus" description="Claim a bonus with a wagering requirement and its progress will be tracked here." className="py-8" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((b) => (
              <ActiveBonusCard key={b.id} bonus={b} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
          <History className="size-5 text-violet" /> History
        </h2>
        {history.isError ? (
          <EmptyState title="Could not load history" description={errorMessage(history.error)} />
        ) : history.isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (history.data?.length ?? 0) === 0 ? (
          <EmptyState title="No claims yet" description="Your first claim will appear here with its wagering status." className="py-8" />
        ) : (
          <BonusHistoryTable items={history.data!} />
        )}
      </section>
    </div>
  );
}
