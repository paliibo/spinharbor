'use client';
import { Info } from 'lucide-react';
import { ProviderCard } from '@/components/player/provider-card';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useProviders } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

export default function ProvidersPage() {
  const providers = useProviders();
  const operational = providers.data?.filter((p) => p.status === 'OPERATIONAL').length ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Casino" title="Game providers" description="Each provider is a pluggable integration. The platform models the three common patterns, but only the internal studio ships with a working engine." />
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-cyan/30 bg-cyan/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-cyan" />
        <p className="text-muted">
          <span className="font-semibold text-text">Only SpinHarbor Studios is operational.</span> Third-party providers are catalogue-only demonstrations of the seamless-wallet and transfer-wallet integration contracts; their games open as previews without gameplay.
          {providers.data && ` ${operational} of ${providers.data.length} providers live.`}
        </p>
      </div>
      {providers.isError ? (
        <EmptyState title="Could not load providers" description={errorMessage(providers.error)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          {providers.data?.map((p, i) => (
            <ProviderCard key={p.id} provider={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
