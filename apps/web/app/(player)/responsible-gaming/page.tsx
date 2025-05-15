'use client';
import { Info } from 'lucide-react';
import { RequireAuth } from '@/components/layout/require-auth';
import { CoolingOffCard, LimitsManager, RgStatusBanner, SelfExclusionCard } from '@/components/player/rg-cards';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useResponsibleGaming } from '@/features/rg/use-rg';
import { errorMessage } from '@/lib/api';

export default function ResponsibleGamingPage() {
  return (
    <RequireAuth>
      <ResponsibleGaming />
    </RequireAuth>
  );
}

function ResponsibleGaming() {
  const rg = useResponsibleGaming();
  const restricted = !!rg.data && rg.data.status !== 'ACTIVE';
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Responsible gaming" description="Tools to keep play in check. Every limit is enforced server-side on each round and each bonus claim, not just in the UI." />
      {rg.isError ? (
        <EmptyState title="Could not load status" description={errorMessage(rg.error)} />
      ) : rg.isLoading || !rg.data ? (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <>
          <RgStatusBanner data={rg.data} />
          <LimitsManager data={rg.data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <CoolingOffCard disabled={restricted} />
            <SelfExclusionCard disabled={rg.data.status === 'SELF_EXCLUDED'} />
          </div>
        </>
      )}
      <section className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted" data-testid="rg-disclaimer">
        <Info className="mt-0.5 size-4 shrink-0 text-cyan" />
        <p>
          <span className="font-semibold text-text">This is a portfolio demonstration, not certified compliance infrastructure.</span> The limits, cooling-off and self-exclusion flows follow the shape of real responsible-gambling requirements, but SpinHarbor handles only virtual demo credits, is not licensed by any regulator and performs no identity verification. If gambling is a problem for you or someone you know, contact a local support service such as BeGambleAware or Gamblers Anonymous.
        </p>
      </section>
    </div>
  );
}
