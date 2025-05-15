'use client';
import { AlertTriangle, Blocks, Plug, PlugZap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useAdminProviders, useStaffRole, useUpdateProvider, type AdminProviderRow } from '@/features/admin/use-admin';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { BoolIcon, ErrorCard, JsonView, StatusBadge, TimeCell } from '@/components/admin/shared';

const INTEGRATION_COPY: Record<AdminProviderRow['integrationType'], string> = {
  INTERNAL: 'In-house engines running inside the API process. Fully playable.',
  SEAMLESS_WALLET: 'Provider calls back into our wallet per bet/win. Adapter documents the callback surface; no live endpoint.',
  TRANSFER_WALLET: 'Funds are moved into a provider-side session wallet. Adapter stub only.',
};

function ProviderCard({ p }: { p: AdminProviderRow }) {
  const update = useUpdateProvider();
  const { isOperator } = useStaffRole();
  const [stubError, setStubError] = useState<string | null>(null);
  const isInternal = p.integrationType === 'INTERNAL';
  const enabled = p.status === 'OPERATIONAL';
  const set = (status: 'OPERATIONAL' | 'DISABLED') => {
    setStubError(null);
    update
      .mutateAsync({ id: p.id, status })
      .then(() => toast.success(`${p.name} ${status.toLowerCase()}`))
      .catch((e) => {
        if (e instanceof ApiRequestError && e.code === 'PROVIDER_STUB') setStubError(e.message);
        toast.error(errorMessage(e));
      });
  };
  return (
    <article className="card-surface flex flex-col gap-4 p-5" data-testid="provider-card" data-code={p.code}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-lg ${isInternal ? 'bg-purple/15 text-violet' : 'bg-surface-3 text-muted'}`}>{isInternal ? <PlugZap className="size-5" /> : <Plug className="size-5" />}</div>
          <div>
            <h3 className="font-semibold">{p.name}</h3>
            <p className="font-mono text-[11px] text-muted-2">{p.code}</p>
          </div>
        </div>
        <StatusBadge status={p.status} />
      </header>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge variant={isInternal ? 'purple' : 'outline'}>{p.integrationType.replace('_', ' ')}</Badge>
        <Badge variant="outline">{p.gameCount} games</Badge>
        <Badge variant="outline">{p.sessionCount} sessions</Badge>
      </div>
      <p className="text-sm text-muted">{p.description ?? INTEGRATION_COPY[p.integrationType]}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-2">Adapter loaded</dt>
          <dd>
            <BoolIcon value={p.adapterLoaded} trueLabel="Registered" falseLabel="Missing" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-2">Last sync</dt>
          <dd>{p.lastSyncAt ? <TimeCell iso={p.lastSyncAt} /> : <span className="text-muted-2">never</span>}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Config</p>
        <JsonView value={p.config} maxHeight={160} />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Error history</p>
        {p.errors.length === 0 ? (
          <p className="text-xs text-muted-2">No errors recorded.</p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {p.errors.map((e) => (
              <li key={e.id} className="rounded-md border border-danger/20 bg-danger/5 px-2.5 py-1.5 text-xs">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-danger" />
                  <div className="min-w-0 flex-1">
                    <p>{e.message}</p>
                    <p className="text-[10px] text-muted-2">
                      {formatDate(e.createdAt)}
                      {e.context ? ` · ${JSON.stringify(e.context)}` : ''}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {stubError && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="provider-stub-error">
          {stubError}
        </p>
      )}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-2">{isInternal ? 'Can be toggled freely.' : 'Integration stub — enabling returns 409 PROVIDER_STUB.'}</span>
        {enabled ? (
          <Button size="sm" variant="danger" disabled={!isOperator} loading={update.isPending} onClick={() => set('DISABLED')} data-testid="provider-disable">
            Disable
          </Button>
        ) : (
          <Button size="sm" variant="success" disabled={!isOperator} loading={update.isPending} onClick={() => set('OPERATIONAL')} data-testid="provider-enable">
            Enable
          </Button>
        )}
      </footer>
    </article>
  );
}

export default function AdminProvidersPage() {
  const q = useAdminProviders();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Catalogue" title="Providers" description="Game studios integrated through the provider adapter layer." />
      <div className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-muted">
        <p className="font-semibold text-text">About external providers</p>
        <p className="mt-1">
          Only <span className="text-violet">SpinHarbor Studios</span> (INTERNAL) runs real game engines. The other studios are <strong className="text-text">deliberately disabled integration stubs</strong>: their adapters document the seamless-wallet and transfer-wallet contracts (session launch, bet/win callbacks, reconciliation) without
          any live endpoint. Attempting to enable one is rejected by the API with <code className="font-mono text-xs">409 PROVIDER_STUB</code> so the catalogue can never advertise games that cannot settle.
        </p>
      </div>
      {q.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorCard error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Blocks />} title="No providers configured" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="providers-grid">
          {q.data.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
