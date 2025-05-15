'use client';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Inbox, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import type { UseQueryResult } from '@tanstack/react-query';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { cn, formatDate, relativeTime } from '@/lib/utils';

/* ────────────────────────── paged filters ────────────────────────── */

/** Filter + page state for a paginated list; changing any filter resets to page 1 in the same update. */
export function usePagedFilters<T extends Record<string, string>>(initial: T) {
  const [state, setState] = React.useState<{ filters: T; page: number }>({ filters: initial, page: 1 });
  const setFilter = React.useCallback(<K extends keyof T>(key: K, value: T[K]) => setState((s) => (s.filters[key] === value ? s : { filters: { ...s.filters, [key]: value }, page: 1 })), []);
  const setPage = React.useCallback((page: number) => setState((s) => ({ ...s, page })), []);
  return { filters: state.filters, page: state.page, setFilter, setPage };
}

/** Debounced mirror of a text input; `onSettle` runs in the timer callback with the trimmed value. */
export function useDebouncedInput(onSettle: (value: string) => void, delay = 300) {
  const [value, setValue] = React.useState('');
  const cb = React.useRef(onSettle);
  React.useEffect(() => {
    cb.current = onSettle;
  });
  React.useEffect(() => {
    const t = setTimeout(() => cb.current(value.trim()), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return [value, setValue] as const;
}

/* ────────────────────────── money ────────────────────────── */

/** Signed/coloured credit amount. Wire values are integer minor units (100 = 1.00). */
export function Money({ minor, sign = false, colored = false, compact = false, className }: { minor: number | null | undefined; sign?: boolean; colored?: boolean; compact?: boolean; className?: string }) {
  const n = minor ?? 0;
  const tone = colored ? (n < 0 ? 'text-danger' : n > 0 ? 'text-success' : 'text-muted') : undefined;
  return <span className={cn('tabular', tone, className)}>{credits(minor, { sign, compact })}</span>;
}

/* ────────────────────────── ids & copy ────────────────────────── */

export function copyText(text: string, label = 'Copied') {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label, { description: text, duration: 2000 }))
    .catch(() => toast.error('Clipboard unavailable'));
}

export function ShortId({ id, chars = 8, copy = true, className }: { id: string; chars?: number; copy?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs text-muted', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-text">{id.slice(0, chars)}</span>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{id}</TooltipContent>
      </Tooltip>
      {copy && (
        <button
          type="button"
          aria-label="Copy id"
          className="rounded p-0.5 text-muted-2 hover:bg-surface-3 hover:text-text focus-ring"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            copyText(id, 'ID copied');
          }}
        >
          <Copy className="size-3" />
        </button>
      )}
    </span>
  );
}

/* ────────────────────────── time ────────────────────────── */

export function TimeCell({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={cn('text-muted-2', className)}>—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('whitespace-nowrap text-xs text-muted', className)}>{relativeTime(iso)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatDate(iso)}</TooltipContent>
    </Tooltip>
  );
}

/* ────────────────────────── JSON ────────────────────────── */

export function JsonView({ value, className, maxHeight = 320 }: { value: unknown; className?: string; maxHeight?: number }) {
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2) ?? 'null';
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <pre className={cn('overflow-auto rounded-md border border-border bg-bg/70 p-3 font-mono text-[11px] leading-relaxed text-muted', className)} style={{ maxHeight }}>
      {text}
    </pre>
  );
}

export function CollapsibleJson({ value, label = 'metadata' }: { value: unknown; label?: string }) {
  const [open, setOpen] = React.useState(false);
  if (value === null || value === undefined) return <span className="text-muted-2">—</span>;
  const empty = typeof value === 'object' && Object.keys(value as object).length === 0;
  if (empty) return <span className="text-muted-2">{'{}'}</span>;
  return (
    <div>
      <button type="button" className="inline-flex items-center gap-1 text-xs text-violet hover:underline focus-ring rounded" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {open ? `hide ${label}` : `show ${label}`}
      </button>
      {open && <JsonView value={value} className="mt-2 max-w-xl" />}
    </div>
  );
}

/* ────────────────────────── states ────────────────────────── */

export function ErrorCard({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm', className)} role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger">Request failed</p>
        <p className="mt-0.5 break-words text-muted">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3" aria-busy>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Unified loading / error / empty / content switch for a query. */
export function QueryState<T>({ query, isEmpty, empty, skeleton, children }: { query: UseQueryResult<T>; isEmpty?: (data: T) => boolean; empty?: React.ReactNode; skeleton?: React.ReactNode; children: (data: T) => React.ReactNode }) {
  if (query.isPending) return <>{skeleton ?? <TableSkeleton />}</>;
  if (query.isError) return <ErrorCard error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data as T;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState icon={<Inbox />} title="Nothing here yet" description="No records match the current filters." />}</>;
  return <>{children(data)}</>;
}

/* ────────────────────────── layout helpers ────────────────────────── */

export function Section({ title, description, actions, children, className, bodyClassName }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface/60 p-3', className)}>{children}</div>;
}

export function Field({ label, children, className, hint, error }: { label: React.ReactNode; children: React.ReactNode; className?: string; hint?: React.ReactNode; error?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted-2">{hint}</p> : null}
    </div>
  );
}

/** Native select styled like the Input primitive – plays nicely with react-hook-form `register`. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select ref={ref} className={cn('flex h-10 w-full appearance-none rounded-md border border-border bg-surface px-3 pr-8 text-sm text-text focus-ring focus-visible:border-violet disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
  </div>
));
NativeSelect.displayName = 'NativeSelect';

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }>(({ label, className, ...props }, ref) => (
  <label className={cn('flex cursor-pointer items-center gap-2 text-sm', props.disabled && 'cursor-not-allowed opacity-60', className)}>
    <input ref={ref} type="checkbox" className="size-4 shrink-0 cursor-pointer rounded border-border bg-surface accent-purple focus-ring" {...props} />
    <span>{label}</span>
  </label>
));
Checkbox.displayName = 'Checkbox';

export function DescriptionList({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-2">{it.label}</dt>
          <dd className="text-sm">{it.value ?? <span className="text-muted-2">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KpiTile({ label, value, hint, icon: Icon, tone = 'default', className, testId }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: 'default' | 'gold' | 'purple' | 'cyan' | 'success' | 'danger' | 'warning'; className?: string; testId?: string }) {
  const color = { default: 'text-text', gold: 'text-gold-2', purple: 'text-violet', cyan: 'text-cyan', success: 'text-success', danger: 'text-danger', warning: 'text-warning' }[tone];
  const iconBg = { default: 'bg-surface-3 text-muted', gold: 'bg-gold/15 text-gold-2', purple: 'bg-purple/15 text-violet', cyan: 'bg-cyan/10 text-cyan', success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', warning: 'bg-warning/10 text-warning' }[tone];
  return (
    <div className={cn('card-surface flex items-start gap-3 p-4', className)} data-testid={testId}>
      {Icon && (
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className={cn('mt-0.5 truncate text-xl font-bold tabular', color)}>{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-muted-2">{hint}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-muted-2">—</span>;
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

const ENGINE_TONE: Record<string, 'purple' | 'gold' | 'cyan' | 'success' | 'default'> = { SLOTS: 'purple', CRASH: 'cyan', DICE: 'gold', ROULETTE: 'success', DEMO_PREVIEW: 'default' };
export function EngineBadge({ engine }: { engine: string }) {
  return <Badge variant={ENGINE_TONE[engine] ?? 'default'}>{engine.replace(/_/g, ' ')}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const variant = role === 'ADMIN' ? 'gold' : role === 'OPERATOR' ? 'purple' : role === 'SUPPORT' ? 'cyan' : 'default';
  return <Badge variant={variant}>{role}</Badge>;
}

export function BoolIcon({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Check className="size-3.5" /> {trueLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-2">{falseLabel}</span>
  );
}

/** Pretty sum check for a set of journal lines. */
export function sumMinor(lines: { amountMinor: number }[]) {
  return lines.reduce((a, l) => a + l.amountMinor, 0);
}

/* ────────────────────────── charts ────────────────────────── */

export const chart = {
  staked: '#9b6bff',
  payout: '#d4a84b',
  ggrPos: '#3ad28c',
  ggrNeg: '#ff5c7a',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#6f6d82',
  series: ['#9b6bff', '#d4a84b', '#36d6e7', '#3ad28c', '#ff5c7a', '#ffb547'],
};

export const axisProps = { tick: { fill: chart.axis, fontSize: 11 }, axisLine: { stroke: chart.grid }, tickLine: false as const };

export function ChartTooltip({ active, payload, label, formatter }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[]; label?: string | number; formatter?: (value: number, name: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-2xl">
      {label !== undefined && <p className="mb-1 font-semibold text-text">{String(label)}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="tabular text-text">{formatter ? formatter(Number(p.value), String(p.name)) : String(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
}
