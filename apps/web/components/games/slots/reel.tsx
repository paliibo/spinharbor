'use client';
import { SLOT_SYMBOLS, type SlotSymbol } from '@spinharbor/contracts';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SYMBOL_META, SymbolIcon } from './symbol-icon';

export type ReelPhase = 'idle' | 'spinning' | 'stopped';

/** Deterministic pseudo-random strip so the blur loop looks varied but stable across renders. */
function buildStrip(seed: number, length: number): SlotSymbol[] {
  const out: SlotSymbol[] = [];
  let x = seed * 2654435761 + 1;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out.push(SLOT_SYMBOLS[x % SLOT_SYMBOLS.length]);
  }
  return out;
}

export function Reel({ index, symbols, phase, highlight, anyWin }: { index: number; symbols: SlotSymbol[]; phase: ReelPhase; highlight: Set<number>; anyWin: boolean }) {
  const strip = useMemo(() => buildStrip(index + 7, 12), [index]);
  return (
    <div className="relative aspect-[1/3] min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-[radial-gradient(ellipse_at_top,rgba(109,61,245,0.18),transparent_60%),linear-gradient(180deg,#15151f,#0f0f16)] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]" data-testid="slots-reel" data-reel={index} data-phase={phase}>
      {/* top/bottom shading */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-black/60 to-transparent" />
      {phase === 'spinning' ? (
        <div className="sh-reel-strip absolute inset-x-0 top-0 flex flex-col blur-[2px]" aria-hidden>
          {[...strip, ...strip].map((s, i) => (
            <div key={i} className="flex aspect-square w-full items-center justify-center p-[14%]">
              <SymbolIcon symbol={s} className="h-full w-full opacity-80" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          key={symbols.join('-') + phase}
          initial={phase === 'stopped' ? { y: -28, opacity: 0.6 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className="absolute inset-0 flex flex-col"
        >
          {symbols.map((s, row) => {
            const hit = highlight.has(row);
            return (
              <div key={row} className={cn('relative flex flex-1 items-center justify-center p-[12%] transition-opacity duration-300', anyWin && !hit && 'opacity-35')} data-testid="slots-cell" data-symbol={s} data-win={hit ? 'true' : undefined}>
                {hit && (
                  <motion.div
                    className="absolute inset-[6%] rounded-lg"
                    style={{ boxShadow: `0 0 0 2px ${SYMBOL_META[s].color}, 0 0 24px 4px ${SYMBOL_META[s].glow}` }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0.6, 1, 0.6], scale: [0.96, 1.02, 0.96] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <SymbolIcon symbol={s} className={cn('relative h-full w-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]', hit && 'scale-110')} />
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
