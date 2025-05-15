'use client';
import { Activity, Dice5, Gift, ShieldAlert, Workflow } from 'lucide-react';
import { useOpsActivity, type OpsActivityEvent } from '@/features/admin/use-admin';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { CollapsibleJson, Section } from './shared';

const KIND: Record<OpsActivityEvent['kind'], { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  round: { icon: Dice5, tone: 'bg-purple/15 text-violet', label: 'Round' },
  session: { icon: Workflow, tone: 'bg-cyan/10 text-cyan', label: 'Session' },
  bonus: { icon: Gift, tone: 'bg-gold/15 text-gold-2', label: 'Bonus' },
  status: { icon: ShieldAlert, tone: 'bg-danger/10 text-danger', label: 'Status' },
};

export function LiveFeed({ className }: { className?: string }) {
  const { events, live, error, clear } = useOpsActivity(60);
  return (
    <Section
      className={className}
      title={
        <span className="flex items-center gap-2">
          Live activity
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" data-testid="live-indicator" data-live={live}>
            <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-success' : 'bg-muted-2')}>{live && <span className="absolute inset-0 animate-ping rounded-full bg-success/70" />}</span>
            {live ? 'Live' : 'Offline'}
          </span>
        </span>
      }
      description={error ? `Socket: ${error}` : 'ops:activity events pushed by the API as rounds settle, sessions open and bonuses are claimed.'}
      actions={
        <Button size="sm" variant="ghost" onClick={clear} disabled={!events.length}>
          Clear
        </Button>
      }
      bodyClassName="p-0"
    >
      <ul className="max-h-[420px] divide-y divide-border overflow-y-auto" data-testid="live-feed">
        {events.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted">
            <Activity className="size-5 text-muted-2" />
            {live ? 'Waiting for activity… play a round in another tab to see it appear here.' : 'Connecting to the ops channel…'}
          </li>
        )}
        {events.map((e) => {
          const k = KIND[e.kind] ?? KIND.round;
          const Icon = k.icon;
          return (
            <li key={e.id} className="flex gap-3 px-5 py-2.5 text-sm animate-in" data-testid="live-event">
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', k.tone)}>
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate">{e.summary}</p>
                  <span className="shrink-0 text-[11px] text-muted-2">{formatDate(e.at, { timeStyle: 'medium' })}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-2">
                  <span className="uppercase tracking-wide">{k.label}</span>
                  {e.data !== undefined && <CollapsibleJson value={e.data} label="payload" />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
