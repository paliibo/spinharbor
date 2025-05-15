'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { credits } from '@/lib/format';
import type { SessionStatsDto } from '@/features/games/use-game-session';

/** Animated count-up for monetary values (minor units). Re-runs whenever `value` changes. */
export function useCountUp(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (to - from) * eased);
      setDisplay(cur);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

export function CountUpCredits({ value, className, durationMs }: { value: number; className?: string; durationMs?: number }) {
  const v = useCountUp(value, durationMs);
  return <span className={cn('tabular', className)}>{credits(v)}</span>;
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('card-surface overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatPill({ label, value, accent }: { label: string; value: ReactNode; accent?: 'gold' | 'success' | 'danger' | 'cyan' | 'muted' }) {
  const color = accent === 'gold' ? 'text-gold-2' : accent === 'success' ? 'text-success' : accent === 'danger' ? 'text-danger' : accent === 'cyan' ? 'text-cyan' : 'text-text';
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-surface/60 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-2">{label}</span>
      <span className={cn('truncate text-sm font-bold tabular', color)}>{value}</span>
    </div>
  );
}

export function netAccent(n: number): 'success' | 'danger' | 'muted' {
  return n > 0 ? 'success' : n < 0 ? 'danger' : 'muted';
}

export function SessionStatsGrid({ stats, className }: { stats: SessionStatsDto | undefined; className?: string }) {
  const s = stats ?? { rounds: 0, wins: 0, losses: 0, stakedMinor: 0, paidMinor: 0, netMinor: 0, biggestWinMinor: 0 };
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
      <StatPill label="Rounds" value={s.rounds} />
      <StatPill label="Wins / Losses" value={`${s.wins} / ${s.losses}`} />
      <StatPill label="Net" value={credits(s.netMinor, { sign: true })} accent={netAccent(s.netMinor)} />
      <StatPill label="Staked" value={credits(s.stakedMinor)} />
      <StatPill label="Paid out" value={credits(s.paidMinor)} />
      <StatPill label="Biggest win" value={credits(s.biggestWinMinor)} accent="gold" />
    </div>
  );
}

/** Quick-amount button used by every bet panel. */
export function AmountChip({ active, onClick, children, disabled, testId }: { active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-9 min-w-14 rounded-md border px-2.5 text-xs font-semibold tabular transition-all focus-ring disabled:opacity-40',
        active ? 'border-violet bg-purple/25 text-text shadow-[0_0_0_1px_rgba(155,107,255,0.5)]' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export function LabelRow({ label, hint, children }: { label: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {hint && <span className="text-xs text-muted-2">{hint}</span>}
      {children}
    </div>
  );
}
