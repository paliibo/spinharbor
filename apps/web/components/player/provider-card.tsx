'use client';
import type { ProviderSummaryDto } from '@spinharbor/contracts';
import { ArrowRight, Blocks, Cable, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Badge, statusVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const INTEGRATION: Record<ProviderSummaryDto['integrationType'], { label: string; text: string; icon: typeof Blocks }> = {
  INTERNAL: { label: 'Internal engines', text: 'Games run inside the SpinHarbor API with native ledger access.', icon: Blocks },
  SEAMLESS_WALLET: { label: 'Seamless wallet', text: 'Third-party games would debit and credit the wallet via signed callbacks.', icon: Cable },
  TRANSFER_WALLET: { label: 'Transfer wallet', text: 'Funds would be transferred to the provider for a session and back on exit.', icon: Wallet },
};

const STATUS_TEXT: Record<ProviderSummaryDto['status'], string> = {
  OPERATIONAL: 'Live – every game is playable.',
  NOT_CONFIGURED: 'Integration scaffolded, credentials not set. Catalogue only.',
  DISABLED: 'Switched off by the operator. Catalogue only.',
  ERROR: 'Health check failing. Catalogue only.',
};

export function ProviderCard({ provider, index = 0 }: { provider: ProviderSummaryDto; index?: number }) {
  const meta = INTEGRATION[provider.integrationType];
  const live = provider.status === 'OPERATIONAL';
  const Icon = meta.icon;
  return (
    <Link href={`/casino?provider=${encodeURIComponent(provider.code)}`} className={cn('group card-surface flex flex-col gap-4 p-5 transition-colors hover:border-violet/50 focus-ring', !live && 'opacity-90')} data-testid="provider-card" data-code={provider.code} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-11 items-center justify-center rounded-lg', live ? 'bg-purple/20 text-violet' : 'bg-surface-3 text-muted')}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="font-bold leading-tight">{provider.name}</p>
            <p className="text-xs text-muted-2">{provider.code}</p>
          </div>
        </div>
        <Badge variant={statusVariant(provider.status)}>{provider.status.replace('_', ' ').toLowerCase()}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Integration</dt>
          <dd className="font-medium">{meta.label}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Games</dt>
          <dd className="font-medium tabular">{provider.gameCount}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">{meta.text}</p>
      <p className={cn('text-xs', live ? 'text-success' : 'text-warning')}>{STATUS_TEXT[provider.status]}</p>
      <span className="mt-auto flex items-center gap-1 text-sm font-medium text-muted group-hover:text-text">
        Browse games <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
