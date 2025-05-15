'use client';
import type { GameRoundDto, RouletteBet, RouletteConfig, RouletteRoundResult } from '@spinharbor/contracts';
import { AnimatePresence, motion } from 'motion/react';
import { Eraser, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlayRoulette, useRoundHistory, useSessionStats } from '@/features/games/use-game-session';
import { useSound } from '@/features/games/use-sound';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GameComponentProps } from '../game-frame';
import { AmountChip, CountUpCredits, LabelRow, Panel, SessionStatsGrid } from '../shared';
import { BettingTable, Chip, betLabel, cellKey, colorClass, numberColor, type CellKey } from './betting-table';
import { RouletteWheel, type WheelHandle } from './wheel';

interface Placement extends RouletteBet {
  key: CellKey;
}

interface ResultItem {
  id: string;
  number: number;
  color: 'RED' | 'BLACK' | 'GREEN';
}

export function RouletteGame({ session, game }: GameComponentProps) {
  const config = session.config as RouletteConfig;
  const wallet = useWallet();
  const stats = useSessionStats(session.id);
  const rounds = useRoundHistory('ROULETTE', 12);
  const play = usePlayRoulette();
  const sound = useSound();
  const wheel = useRef<WheelHandle>(null);
  const red = useMemo(() => new Set(config.redNumbers), [config.redNumbers]);

  const [chip, setChip] = useState<number>(() => config.chipOptionsMinor[0] ?? 100);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<(RouletteRoundResult & { id: string; stakeMinor: number }) | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [localResults, setLocalResults] = useState<ResultItem[]>([]);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const placed = useMemo(() => {
    const m = new Map<CellKey, number>();
    for (const p of placements) m.set(p.key, (m.get(p.key) ?? 0) + p.amountMinor);
    return m;
  }, [placements]);
  const aggregatedBets = useMemo<RouletteBet[]>(() => {
    const byKey = new Map<CellKey, RouletteBet>();
    for (const p of placements) {
      const cur = byKey.get(p.key);
      if (cur) cur.amountMinor += p.amountMinor;
      else byKey.set(p.key, { type: p.type, ...(p.type === 'STRAIGHT' ? { number: p.number } : {}), amountMinor: p.amountMinor });
    }
    return [...byKey.values()];
  }, [placements]);
  const total = aggregatedBets.reduce((s, b) => s + b.amountMinor, 0);
  const available = (wallet.data?.balanceMinor ?? 0) + (wallet.data?.bonusBalanceMinor ?? 0);
  const insufficient = wallet.data ? available < total : false;
  const tooMany = aggregatedBets.length > config.maxBetsPerSpin;
  const overMax = total > game.maxBetMinor;
  const busy = spinning || play.isPending;
  const canSpin = !busy && aggregatedBets.length > 0 && !insufficient && !tooMany && !overMax;

  const addChip = useCallback(
    (b: Pick<RouletteBet, 'type' | 'number'>) => {
      if (busy) return;
      sound.play('click');
      setRevealed(false);
      setPlacements((p) => [...p, { ...b, amountMinor: chip, key: cellKey(b) }]);
    },
    [busy, chip, sound],
  );

  const spin = useCallback(async () => {
    if (!canSpin) return;
    setSpinning(true);
    setRevealed(false);
    setResult(null);
    sound.play('spin');
    try {
      const res = await play.mutateAsync({ sessionId: session.id, bets: aggregatedBets });
      const r = res.round.result;
      await wheel.current?.spinTo(r.winningNumber);
      if (!mounted.current) return;
      setResult({ ...r, id: res.round.id, stakeMinor: res.round.stakeMinor });
      setRevealed(true);
      setLocalResults((h) => [{ id: res.round.id, number: r.winningNumber, color: r.color }, ...h].slice(0, 12));
      setPlacements([]);
      if (r.totalPayoutMinor >= res.round.stakeMinor * 5) sound.play('bigwin');
      else if (r.totalPayoutMinor > 0) sound.play('win');
      else sound.play('lose');
    } catch {
      /* toasted by the mutation */
    } finally {
      if (mounted.current) setSpinning(false);
    }
  }, [canSpin, sound, play, session.id, aggregatedBets]);

  const results = useMemo<ResultItem[]>(() => {
    const server = (rounds.data?.items ?? []).map((r: GameRoundDto) => {
      const res = r.result as RouletteRoundResult;
      return { id: r.id, number: res.winningNumber, color: res.color };
    });
    const seen = new Set<string>();
    return [...localResults, ...server].filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true))).slice(0, 12);
  }, [localResults, rounds.data]);

  const wonBets = result?.bets.filter((b) => b.won) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="roulette-game">
      <div className="flex flex-col gap-4">
        <div className="card-surface relative overflow-hidden p-3 sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,168,75,0.12),transparent_55%)]" />
          <div className="relative grid gap-4 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-start">
            <div className="flex flex-col items-center gap-3">
              <RouletteWheel ref={wheel} wheelOrder={config.wheelOrder} redNumbers={config.redNumbers} spinning={spinning} lastNumber={revealed && result ? result.winningNumber : null} onTick={() => sound.play('tick')} />
              <div className="flex w-full items-center gap-1 overflow-x-auto no-scrollbar" data-testid="roulette-history" aria-label="Last results">
                {results.length === 0 ? (
                  <span className="text-xs text-muted-2">No spins yet.</span>
                ) : (
                  results.map((r, i) => (
                    <span key={r.id} className={cn('flex size-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold tabular', colorClass[r.color], i === 0 && 'ring-2 ring-gold/70')}>
                      {r.number}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="min-h-32">
              <AnimatePresence mode="wait">
                {revealed && result ? (
                  <motion.div key={result.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('rounded-xl border p-4', result.totalPayoutMinor > 0 ? 'border-gold/40 bg-gradient-to-b from-gold/15 to-transparent' : 'border-border bg-surface/60')} data-testid="roulette-result" data-number={result.winningNumber} data-payout={result.totalPayoutMinor}>
                    <div className="flex items-center gap-3">
                      <span className={cn('flex size-12 items-center justify-center rounded-lg border text-xl font-black tabular shadow-lg', colorClass[result.color])} data-testid="roulette-winning-number">
                        {result.winningNumber}
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          {result.color.toLowerCase()} · {result.winningNumber === 0 ? 'zero' : result.winningNumber % 2 ? 'odd' : 'even'}
                        </p>
                        <p className={cn('text-2xl font-black', result.totalPayoutMinor > 0 ? 'gold-text' : 'text-muted')}>
                          {result.totalPayoutMinor > 0 ? <CountUpCredits value={result.totalPayoutMinor} /> : 'No win'}
                        </p>
                      </div>
                      <div className="ml-auto text-right text-xs text-muted">
                        <p>Staked {credits(result.totalStakeMinor)}</p>
                        <p className={cn('font-semibold tabular', result.totalPayoutMinor - result.totalStakeMinor >= 0 ? 'text-success' : 'text-danger')}>Net {credits(result.totalPayoutMinor - result.totalStakeMinor, { sign: true })}</p>
                      </div>
                    </div>
                    {wonBets.length > 0 && (
                      <ul className="mt-3 grid gap-1 sm:grid-cols-2" data-testid="roulette-won-bets">
                        {wonBets.map((b, i) => (
                          <li key={i} className="flex items-center justify-between rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs">
                            <span className="text-muted">
                              {betLabel(b)} · {credits(b.amountMinor)} × {config.payouts[b.type] + 1}
                            </span>
                            <span className="font-semibold text-gold-2 tabular">+{credits(b.payoutMinor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-2">
                    {spinning ? 'No more bets — the ball is rolling…' : placements.length === 0 ? 'Select a chip and click the table to place bets.' : `${aggregatedBets.length} bet${aggregatedBets.length === 1 ? '' : 's'} on the table · ${credits(total)}`}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative mt-4">
            <BettingTable config={config} placed={placed} onCell={addChip} disabled={busy} winningNumber={revealed && result ? result.winningNumber : null} />
          </div>
        </div>

        <Panel title="Session statistics">
          <SessionStatsGrid stats={stats.data} />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Bet" className="lg:sticky lg:top-20">
          <div className="space-y-4">
            <div>
              <LabelRow label="Chip" hint={`max ${config.maxBetsPerSpin} bets`} />
              <div className="mt-2 flex flex-wrap gap-2" data-testid="roulette-chip" data-value={chip}>
                {config.chipOptionsMinor.map((c) => (
                  <button key={c} type="button" data-testid="roulette-chip-option" data-active={chip === c ? 'true' : undefined} disabled={busy} onClick={() => { setChip(c); sound.play('click'); }} className={cn('rounded-full transition-transform focus-ring', chip === c ? 'scale-110 ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'opacity-80 hover:opacity-100')} aria-label={`Chip ${credits(c)}`} aria-pressed={chip === c}>
                    <Chip amount={c} chipOptions={config.chipOptionsMinor} />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Bets</span>
                <span className="font-semibold tabular">{aggregatedBets.length}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted">Total stake</span>
                <span className="font-bold tabular" data-testid="roulette-total">{credits(total)}</span>
              </div>
              {aggregatedBets.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto border-t border-border pt-2 text-xs text-muted" data-testid="roulette-bets">
                  {aggregatedBets.map((b) => (
                    <li key={cellKey(b)} className="flex justify-between">
                      <span>{betLabel(b)}</span>
                      <span className="tabular text-text">{credits(b.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" data-testid="roulette-undo" disabled={busy || placements.length === 0} onClick={() => { setPlacements((p) => p.slice(0, -1)); sound.play('click'); }}>
                <Undo2 /> Undo
              </Button>
              <Button variant="outline" size="sm" data-testid="roulette-clear" disabled={busy || placements.length === 0} onClick={() => { setPlacements([]); sound.play('click'); }}>
                <Eraser /> Clear
              </Button>
            </div>

            <Button variant="gold" size="xl" className="w-full text-base tracking-wide" data-testid="roulette-spin" disabled={!canSpin} onClick={() => void spin()}>
              {busy ? 'Spinning…' : aggregatedBets.length === 0 ? 'Place a bet' : insufficient ? 'Insufficient balance' : overMax ? `Max ${credits(game.maxBetMinor)} per spin` : tooMany ? `Max ${config.maxBetsPerSpin} bets` : `Spin · ${credits(total)}`}
            </Button>
            <p className="text-center text-[11px] text-muted-2">Balance {wallet.data ? credits(wallet.data.balanceMinor) : '—'}</p>
          </div>
        </Panel>

        <Panel title="Payouts">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
            {(['STRAIGHT', 'DOZEN_1', 'COLUMN_1', 'RED', 'ODD', 'LOW'] as const).map((t) => (
              <li key={t} className="flex justify-between">
                <span>{t === 'STRAIGHT' ? 'Straight' : t.startsWith('DOZEN') ? 'Dozens' : t.startsWith('COLUMN') ? 'Columns' : t === 'RED' ? 'Red / Black' : t === 'ODD' ? 'Odd / Even' : '1–18 / 19–36'}</span>
                <span className="text-gold-2 tabular">{config.payouts[t]} : 1</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-2">European wheel, single zero. {numberColor(0, red) === 'GREEN' ? 'Zero loses all outside bets.' : ''}</p>
        </Panel>
      </div>
    </div>
  );
}
