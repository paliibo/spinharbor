'use client';
import type { PlayerLimitType, ResponsibleGamingDto } from '@spinharbor/contracts';
import { PlayerLimitTypes } from '@spinharbor/contracts';
import { AlertTriangle, Ban, Check, Clock, PauseCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/misc';
import { LIMIT_META, useCoolingOff, useSelfExclude, useSetLimit } from '@/features/rg/use-rg';
import { errorMessage } from '@/lib/api';
import { credits, creditsToMinor, minorToCredits } from '@/lib/format';
import { cn, formatDate } from '@/lib/utils';

export function RgStatusBanner({ data }: { data: ResponsibleGamingDto }) {
  const active = data.status === 'ACTIVE';
  const text = active
    ? 'Your account is active with no restrictions. Limits below are enforced on every round by the server.'
    : data.status === 'COOLING_OFF'
      ? `Cooling-off in effect${data.statusUntil ? ` until ${formatDate(data.statusUntil)}` : ''}. Gameplay and bonus claims are paused; it lifts automatically.`
      : data.status === 'SELF_EXCLUDED'
        ? `Self-excluded${data.statusUntil ? ` until ${formatDate(data.statusUntil)}` : ' indefinitely'}. Gameplay is disabled and cannot be re-enabled from the client.`
        : `Account status: ${data.status.toLowerCase()}. Gameplay is disabled.`;
  return (
    <section className={cn('flex items-start gap-3 rounded-xl border p-5', active ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5')} data-testid="rg-status">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', active ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>{active ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}</div>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-bold">Account status</p>
          <Badge variant={statusVariant(data.status)}>{data.status.replace('_', ' ').toLowerCase()}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </section>
  );
}

function LimitRow({ type, current }: { type: PlayerLimitType; current?: { value: number; usedToday: number } }) {
  const meta = LIMIT_META[type];
  const isMoney = meta.unit === 'credits';
  const setLimit = useSetLimit();
  const [draft, setDraft] = useState<string>(current ? String(isMoney ? minorToCredits(current.value) : current.value) : '');
  const pct = current && current.value > 0 ? Math.min(100, Math.round((current.usedToday / current.value) * 100)) : 0;
  const save = (value: number | null) =>
    setLimit
      .mutateAsync({ type, value })
      .then(() => {
        toast.success(value === null ? `${meta.label} removed` : `${meta.label} saved`);
        if (value === null) setDraft('');
      })
      .catch((e) => toast.error('Could not save limit', { description: errorMessage(e) }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return toast.error('Enter a positive number');
    void save(isMoney ? creditsToMinor(n) : Math.round(n));
  };
  return (
    <form onSubmit={submit} className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" data-testid={`limit-${type}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{meta.label}</p>
          {current ? <Badge variant="purple">{isMoney ? `${credits(current.value)} credits` : `${current.value} min`}</Badge> : <Badge>Not set</Badge>}
        </div>
        <p className="text-sm text-muted">{meta.help}</p>
        {current && (
          <div className="mt-2 max-w-md">
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>Used {type === 'WEEKLY_WAGER' ? 'this week' : 'today'}</span>
              <span className="tabular">
                {isMoney ? credits(current.usedToday) : `${current.usedToday} min`} / {isMoney ? credits(current.value) : `${current.value} min`} ({pct}%)
              </span>
            </div>
            <Progress value={pct} indicatorClassName={pct >= 90 ? 'from-danger to-danger' : pct >= 60 ? 'from-warning to-gold' : undefined} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`limit-${type}`} className="sr-only">
            {meta.label}
          </Label>
          <div className="relative">
            <Input id={`limit-${type}`} type="number" min={1} step={isMoney ? '0.01' : '1'} inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={isMoney ? '500.00' : '60'} className="w-40 pr-14" data-testid={`limit-input-${type}`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-2">{isMoney ? 'credits' : 'min'}</span>
          </div>
        </div>
        <Button type="submit" variant="secondary" loading={setLimit.isPending} data-testid={`limit-save-${type}`}>
          <Check /> Set
        </Button>
        {current && (
          <Button type="button" variant="ghost" size="icon" aria-label="Remove limit" disabled={setLimit.isPending} onClick={() => save(null)} data-testid={`limit-remove-${type}`}>
            <Trash2 />
          </Button>
        )}
      </div>
    </form>
  );
}

export function LimitsManager({ data }: { data: ResponsibleGamingDto }) {
  return (
    <section className="card-surface divide-y divide-border" data-testid="limits">
      <div className="p-5 pb-4">
        <h2 className="text-base font-bold">Play limits</h2>
        <p className="text-sm text-muted">Lowering a limit applies immediately. Removing or raising one applies immediately too in this demo – a certified product would enforce a cooling-off delay.</p>
      </div>
      {PlayerLimitTypes.map((t) => (
        <LimitRow key={t} type={t} current={data.limits.find((l) => l.type === t)} />
      ))}
    </section>
  );
}

const COOL_OFF: { hours: 24 | 72 | 168; label: string }[] = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '72 hours' },
  { hours: 168, label: '7 days' },
];

export function CoolingOffCard({ disabled }: { disabled?: boolean }) {
  const [pick, setPick] = useState<(typeof COOL_OFF)[number] | null>(null);
  const coolOff = useCoolingOff();
  const confirm = () =>
    pick &&
    coolOff
      .mutateAsync(pick.hours)
      .then(() => {
        toast.success(`Cooling-off started for ${pick.label}`);
        setPick(null);
      })
      .catch((e) => toast.error('Could not start cooling-off', { description: errorMessage(e) }));
  return (
    <section className="card-surface p-5" data-testid="cooling-off">
      <div className="flex items-center gap-2">
        <PauseCircle className="size-5 text-cyan" />
        <h2 className="text-base font-bold">Take a break</h2>
      </div>
      <p className="mt-1 text-sm text-muted">A cooling-off period pauses gameplay and bonus claims for a fixed time and lifts automatically. It cannot be shortened once started.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {COOL_OFF.map((o) => (
          <Button key={o.hours} variant="outline" disabled={disabled} onClick={() => setPick(o)} data-testid={`cooling-off-${o.hours}`}>
            <Clock /> {o.label}
          </Button>
        ))}
      </div>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a {pick?.label} cooling-off?</DialogTitle>
            <DialogDescription>Gameplay and bonus claims will be paused for {pick?.label.toLowerCase()} starting now; the exact end time is shown in the status banner once it begins. You stay signed in and can still view your wallet and history.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPick(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={coolOff.isPending} onClick={confirm} data-testid="cooling-off-confirm">
              Start cooling-off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

const EXCLUDE: { days: 30 | 90 | 180 | null; label: string }[] = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
  { days: null, label: 'Indefinitely' },
];

export function SelfExclusionCard({ disabled }: { disabled?: boolean }) {
  const [pick, setPick] = useState<(typeof EXCLUDE)[number] | null>(null);
  const [typed, setTyped] = useState('');
  const exclude = useSelfExclude();
  const close = () => {
    setPick(null);
    setTyped('');
  };
  const confirm = () =>
    pick &&
    exclude
      .mutateAsync(pick.days)
      .then(() => {
        toast.success('Self-exclusion applied');
        close();
      })
      .catch((e) => toast.error('Could not apply self-exclusion', { description: errorMessage(e) }));
  return (
    <section className="rounded-xl border border-danger/30 bg-danger/5 p-5" data-testid="self-exclusion">
      <div className="flex items-center gap-2">
        <Ban className="size-5 text-danger" />
        <h2 className="text-base font-bold">Self-exclusion</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Disables gameplay for the chosen period. It cannot be reversed from this interface – only an operator can lift an indefinite exclusion after a review.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EXCLUDE.map((o) => (
          <Button key={o.label} variant="danger" disabled={disabled} onClick={() => setPick(o)} data-testid={`self-exclude-${o.days ?? 'indefinite'}`}>
            {o.label}
          </Button>
        ))}
      </div>
      <Dialog open={!!pick} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Self-exclude {pick?.label.toLowerCase()}?</DialogTitle>
            <DialogDescription>This immediately blocks all gameplay and bonus claims{pick?.days ? ` for ${pick.label}` : ' until an operator reviews your account'}. Type <span className="font-mono font-semibold text-text">EXCLUDE ME</span> to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exclude-confirm">Confirmation</Label>
            <Input id="exclude-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="EXCLUDE ME" autoComplete="off" data-testid="self-exclude-input" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" disabled={typed.trim() !== 'EXCLUDE ME'} loading={exclude.isPending} onClick={confirm} data-testid="self-exclude-confirm">
              Exclude me
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
