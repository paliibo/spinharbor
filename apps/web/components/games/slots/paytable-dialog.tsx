'use client';
import type { SlotsConfig } from '@spinharbor/contracts';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SYMBOL_META, SymbolIcon } from './symbol-icon';

function PaylineMini({ rows, index }: { rows: number[]; index: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid grid-cols-5 gap-0.5 rounded border border-border bg-surface p-1">
        {Array.from({ length: 3 }).map((_, row) =>
          rows.map((r, reel) => <span key={`${row}-${reel}`} className={cn('size-2.5 rounded-[2px]', r === row ? 'bg-gradient-to-br from-violet to-cyan shadow-[0_0_6px_rgba(155,107,255,0.8)]' : 'bg-surface-3')} />),
        )}
      </div>
      <span className="text-[10px] text-muted-2">Line {index + 1}</span>
    </div>
  );
}

export function PaytableDialog({ config }: { config: SlotsConfig }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="slots-paytable">
          <BookOpen /> Paytable
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paytable</DialogTitle>
          <DialogDescription>
            Payouts are multiples of the total bet for 3, 4 or 5 matching symbols on a payline, left to right. <strong className="text-text">{SYMBOL_META[config.wild].label.split(' ')[0]}</strong> is wild and substitutes for every symbol except the scatter. <strong className="text-text">{SYMBOL_META[config.scatter].label.split(' ')[0]}</strong> is the scatter and pays anywhere on the reels.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[auto_1fr_repeat(3,minmax(0,56px))] items-center gap-x-3 gap-y-1 text-sm">
          <span />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Symbol</span>
          {[3, 4, 5].map((n) => (
            <span key={n} className="text-right text-xs font-semibold uppercase tracking-wider text-muted">
              ×{n}
            </span>
          ))}
          {config.paytable.map((e) => (
            <div key={e.symbol} className="contents">
              <SymbolIcon symbol={e.symbol} size={32} />
              <span>
                {SYMBOL_META[e.symbol].label}
                {e.symbol === config.wild && <span className="ml-1 rounded bg-purple/20 px-1 text-[10px] font-bold uppercase text-violet">wild</span>}
              </span>
              <span className="text-right tabular">{e.payouts[3]}×</span>
              <span className="text-right tabular">{e.payouts[4]}×</span>
              <span className="text-right font-semibold text-gold-2 tabular">{e.payouts[5]}×</span>
            </div>
          ))}
          <div className="contents">
            <SymbolIcon symbol={config.scatter} size={32} />
            <span>
              {SYMBOL_META[config.scatter].label.split(' ')[0]}
              <span className="ml-1 rounded bg-gold/20 px-1 text-[10px] font-bold uppercase text-gold-2">scatter</span>
            </span>
            <span className="text-right tabular">{config.scatterPayouts[3]}×</span>
            <span className="text-right tabular">{config.scatterPayouts[4]}×</span>
            <span className="text-right font-semibold text-gold-2 tabular">{config.scatterPayouts[5]}×</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{config.paylines.length} paylines</p>
          <div className="grid grid-cols-5 gap-3">
            {config.paylines.map((rows, i) => (
              <PaylineMini key={i} rows={rows} index={i} />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-2">Only the highest win per payline is paid. Results are generated server-side and this client only renders them.</p>
      </DialogContent>
    </Dialog>
  );
}
