'use client';
import type { RouletteBet, RouletteBetType, RouletteConfig } from '@spinharbor/contracts';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CellKey = string;
export const cellKey = (b: Pick<RouletteBet, 'type' | 'number'>): CellKey => (b.type === 'STRAIGHT' ? `STRAIGHT:${b.number}` : b.type);

export const OUTSIDE_LABEL: Record<Exclude<RouletteBetType, 'STRAIGHT'>, string> = {
  RED: 'Red',
  BLACK: 'Black',
  ODD: 'Odd',
  EVEN: 'Even',
  LOW: '1–18',
  HIGH: '19–36',
  DOZEN_1: '1st 12',
  DOZEN_2: '2nd 12',
  DOZEN_3: '3rd 12',
  COLUMN_1: '2 to 1',
  COLUMN_2: '2 to 1',
  COLUMN_3: '2 to 1',
};

export function betLabel(b: Pick<RouletteBet, 'type' | 'number'>): string {
  if (b.type === 'STRAIGHT') return `Straight ${b.number}`;
  if (b.type.startsWith('COLUMN')) return `Column ${b.type.slice(-1)}`;
  return OUTSIDE_LABEL[b.type];
}

export function numberColor(n: number, red: Set<number>): 'RED' | 'BLACK' | 'GREEN' {
  return n === 0 ? 'GREEN' : red.has(n) ? 'RED' : 'BLACK';
}

export const colorClass = { RED: 'bg-[#c81e3c] text-white', BLACK: 'bg-[#15151f] text-white border-border-strong', GREEN: 'bg-[#1f9d63] text-white' } as const;

export function Chip({ amount, chipOptions, size = 'md', className }: { amount: number; chipOptions: number[]; size?: 'sm' | 'md'; className?: string }) {
  const idx = Math.max(0, chipOptions.findIndex((c) => c >= amount));
  const palette = ['#9a98ad', '#ff5c7a', '#36d6e7', '#9b6bff', '#f0c66a', '#3ad28c'];
  const color = palette[(idx === -1 ? palette.length - 1 : idx) % palette.length];
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full border-[3px] border-dashed font-black tabular text-[#0b0b10] shadow-[0_2px_6px_rgba(0,0,0,0.6)]', size === 'sm' ? 'size-6 text-[8px]' : 'size-10 text-[11px]', className)}
      style={{ background: color, borderColor: 'rgba(255,255,255,0.75)' }}
      data-testid="roulette-chip-stack"
    >
      {credits(amount, { compact: true }).replace('.00', '')}
    </span>
  );
}

function Cell({ bet, label, placed, chipOptions, onClick, disabled, className, highlight }: { bet: Pick<RouletteBet, 'type' | 'number'>; label: string; placed: Map<CellKey, number>; chipOptions: number[]; onClick: (b: Pick<RouletteBet, 'type' | 'number'>) => void; disabled: boolean; className?: string; highlight?: boolean }) {
  const amount = placed.get(cellKey(bet)) ?? 0;
  return (
    <button
      type="button"
      data-testid="roulette-cell"
      data-bet={cellKey(bet)}
      data-amount={amount || undefined}
      disabled={disabled}
      onClick={() => onClick(bet)}
      className={cn('relative flex min-h-9 items-center justify-center rounded-[4px] border border-gold/25 text-[11px] font-bold transition-all focus-ring enabled:hover:brightness-125 enabled:hover:ring-1 enabled:hover:ring-gold/60 disabled:cursor-not-allowed sm:text-xs', highlight && 'ring-2 ring-gold shadow-[0_0_16px_rgba(240,198,106,0.7)] z-10', className)}
      aria-label={`${label}${amount ? `, ${credits(amount)} placed` : ''}`}
    >
      {label}
      {amount > 0 && (
        <span className="absolute -right-1 -top-1 z-10 sm:-right-1.5 sm:-top-1.5">
          <Chip amount={amount} chipOptions={chipOptions} size="sm" />
        </span>
      )}
    </button>
  );
}

export function BettingTable({ config, placed, onCell, disabled, winningNumber }: { config: RouletteConfig; placed: Map<CellKey, number>; onCell: (b: Pick<RouletteBet, 'type' | 'number'>) => void; disabled: boolean; winningNumber: number | null }) {
  const red = new Set(config.redNumbers);
  const rows = [3, 2, 1]; // top row shows 3,6,9…; bottom 1,4,7…
  return (
    <div className="overflow-x-auto no-scrollbar" data-testid="roulette-table" aria-disabled={disabled}>
      <div className="min-w-[420px] select-none rounded-xl border border-gold/30 bg-[radial-gradient(ellipse_at_top,rgba(31,157,99,0.25),transparent_60%),#0f1a15] p-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: 'minmax(32px,0.9fr) repeat(12, minmax(0,1fr)) minmax(36px,1.1fr)' }}>
          <Cell bet={{ type: 'STRAIGHT', number: 0 }} label="0" placed={placed} chipOptions={config.chipOptionsMinor} onClick={onCell} disabled={disabled} className={cn(colorClass.GREEN, 'row-span-3')} highlight={winningNumber === 0} />
          {rows.map((row) => (
            <div key={row} className="contents">
              {Array.from({ length: 12 }, (_, col) => {
                const n = col * 3 + row;
                const c = numberColor(n, red);
                return <Cell key={n} bet={{ type: 'STRAIGHT', number: n }} label={String(n)} placed={placed} chipOptions={config.chipOptionsMinor} onClick={onCell} disabled={disabled} className={colorClass[c]} highlight={winningNumber === n} />;
              })}
              <Cell bet={{ type: `COLUMN_${row}` as RouletteBetType }} label="2:1" placed={placed} chipOptions={config.chipOptionsMinor} onClick={onCell} disabled={disabled} className="bg-surface-2 text-gold-2" />
            </div>
          ))}
          <div />
          {(['DOZEN_1', 'DOZEN_2', 'DOZEN_3'] as const).map((t) => (
            <Cell key={t} bet={{ type: t }} label={OUTSIDE_LABEL[t]} placed={placed} chipOptions={config.chipOptionsMinor} onClick={onCell} disabled={disabled} className="col-span-4 bg-surface-2 text-text" />
          ))}
          <div />
          <div />
          {(['LOW', 'EVEN', 'RED', 'BLACK', 'ODD', 'HIGH'] as const).map((t) => (
            <Cell key={t} bet={{ type: t }} label={OUTSIDE_LABEL[t]} placed={placed} chipOptions={config.chipOptionsMinor} onClick={onCell} disabled={disabled} className={cn('col-span-2', t === 'RED' ? colorClass.RED : t === 'BLACK' ? colorClass.BLACK : 'bg-surface-2 text-text')} />
          ))}
          <div />
        </div>
      </div>
    </div>
  );
}
