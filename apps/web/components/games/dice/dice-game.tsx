'use client';
import type { DiceConfig, DiceRoundResult, GameRoundDto } from '@spinharbor/contracts';
import { AnimatePresence, motion } from 'motion/react';
import { Dices } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { usePlayDice, useRoundHistory, useSessionStats } from '@/features/games/use-game-session';
import { useSound } from '@/features/games/use-sound';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits, creditsToMinor, formatMultiplier, minorToCredits } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GameComponentProps } from '../game-frame';
import { AmountChip, LabelRow, Panel, SessionStatsGrid } from '../shared';

type Direction = 'OVER' | 'UNDER';

const fmtRoll = (v: number) => (v / 100).toFixed(2);

/** Mirrors the documented engine formula for the live preview; the server recomputes authoritatively. */
function preview(direction: Direction, target: number, houseEdgeBp: number) {
  const chanceBp = direction === 'OVER' ? 9999 - target : target;
  const multiplierBp = Math.floor(((10_000 - houseEdgeBp) * 10_000) / chanceBp);
  return { chanceBp, multiplierBp };
}

interface DiceHistoryItem {
  id: string;
  roll: number;
  won: boolean;
  multiplierBp: number;
  stakeMinor: number;
  payoutMinor: number;
}

function RollTween({ to, onDone }: { to: number; onDone: () => void }) {
  const [v, setV] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      // Jitter early, converge late.
      const noise = (1 - p) * (Math.random() - 0.5) * 4000;
      setV(p < 1 ? Math.max(0, Math.min(9999, Math.round(to * eased + noise))) : to);
      if (p < 1) raf = requestAnimationFrame(step);
      else done.current();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{fmtRoll(v)}</>;
}

export function DiceGame({ session, game }: GameComponentProps) {
  const config = session.config as DiceConfig;
  const wallet = useWallet();
  const stats = useSessionStats(session.id);
  const rounds = useRoundHistory('DICE', 15);
  const play = usePlayDice();
  const sound = useSound();

  const [betText, setBetText] = useState(() => minorToCredits(config.betOptionsMinor[1] ?? config.betOptionsMinor[0] ?? 100).toFixed(2));
  const [direction, setDirection] = useState<Direction>('OVER');
  const [target, setTarget] = useState(5000);
  const [rolling, setRolling] = useState(false);
  const [settling, setSettling] = useState(false);
  const [last, setLast] = useState<(DiceRoundResult & { stakeMinor: number; payoutMinor: number; id: string }) | null>(null);
  const [localHistory, setLocalHistory] = useState<DiceHistoryItem[]>([]);

  const betMinor = Math.max(0, creditsToMinor(Number.parseFloat(betText) || 0));
  const available = (wallet.data?.balanceMinor ?? 0) + (wallet.data?.bonusBalanceMinor ?? 0);
  const maxBet = Math.min(game.maxBetMinor, wallet.data ? available : game.maxBetMinor);
  const invalidBet = betMinor <= 0 || betMinor < game.minBetMinor || betMinor > game.maxBetMinor;
  const insufficient = wallet.data ? available < betMinor : false;
  const busy = rolling || settling || play.isPending;
  const canRoll = !busy && !invalidBet && !insufficient;

  const pv = useMemo(() => preview(direction, target, config.houseEdgeBp), [direction, target, config.houseEdgeBp]);
  const potentialWin = Math.floor((betMinor * pv.multiplierBp) / 10_000);

  const setBetMinor = (m: number) => setBetText(minorToCredits(Math.max(game.minBetMinor, Math.min(game.maxBetMinor, Math.round(m)))).toFixed(2));

  const roll = useCallback(async () => {
    if (!canRoll) return;
    setRolling(true);
    setSettling(true);
    setLast(null);
    sound.play('spin');
    try {
      const res = await play.mutateAsync({ sessionId: session.id, betMinor, direction, target });
      setLast({ ...res.round.result, stakeMinor: res.round.stakeMinor, payoutMinor: res.round.payoutMinor, id: res.round.id });
      setLocalHistory((h) => [{ id: res.round.id, roll: res.round.result.roll, won: res.round.result.won, multiplierBp: res.round.result.multiplierBp, stakeMinor: res.round.stakeMinor, payoutMinor: res.round.payoutMinor }, ...h].slice(0, 15));
    } catch {
      setSettling(false);
    } finally {
      setRolling(false);
    }
  }, [canRoll, sound, play, session.id, betMinor, direction, target]);

  const onTweenDone = useCallback(() => {
    setSettling(false);
    if (last) sound.play(last.won ? (last.multiplierBp >= 50_000 ? 'bigwin' : 'win') : 'lose');
  }, [last, sound]);

  const history = useMemo<DiceHistoryItem[]>(() => {
    const server = (rounds.data?.items ?? []).map((r: GameRoundDto) => {
      const res = r.result as DiceRoundResult;
      return { id: r.id, roll: res.roll, won: res.won, multiplierBp: res.multiplierBp, stakeMinor: r.stakeMinor, payoutMinor: r.payoutMinor };
    });
    const seen = new Set<string>();
    return [...localHistory, ...server].filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true))).slice(0, 15);
  }, [localHistory, rounds.data]);

  const targetPct = target / 100;
  const showResult = !!last;
  const resultWon = last?.won ?? false;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="dice-game">
      <div className="flex flex-col gap-4">
        <div className="card-surface relative overflow-hidden p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(54,214,231,0.1),transparent_55%)]" />

          {/* Readout */}
          <div className="relative flex min-h-36 flex-col items-center justify-center text-center">
            <AnimatePresence mode="wait">
              {showResult ? (
                <motion.div key={last.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <span className={cn('text-6xl font-black tabular sm:text-7xl', settling ? 'text-text' : resultWon ? 'text-success drop-shadow-[0_0_24px_rgba(58,210,140,0.5)]' : 'text-danger drop-shadow-[0_0_24px_rgba(255,92,122,0.4)]')} data-testid="dice-roll-value">
                    <RollTween to={last.roll} onDone={onTweenDone} />
                  </span>
                  <div className={cn('mt-2 flex items-center gap-2 text-sm font-semibold transition-opacity', settling && 'opacity-0')} data-testid="dice-result" data-outcome={resultWon ? 'WIN' : 'LOSS'} data-roll={fmtRoll(last.roll)}>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider', resultWon ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>{resultWon ? 'WIN' : 'LOSS'}</span>
                    <span className="text-muted">
                      {fmtRoll(last.roll)} · {last.direction === 'OVER' ? 'over' : 'under'} {fmtRoll(last.target)} · {formatMultiplier(last.multiplierBp)}
                    </span>
                    {resultWon && <span className="text-gold-2 tabular">+{credits(last.payoutMinor)}</span>}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-muted-2">
                  <Dices className={cn('size-12', rolling && 'animate-spin')} />
                  <span className="mt-2 text-sm">{rolling ? 'Rolling…' : 'Pick a target and roll'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Track */}
          <div className="relative mt-4 px-2 pb-6 pt-7">
            <div className="relative h-4 overflow-hidden rounded-full border border-border bg-surface">
              <div className={cn('absolute inset-y-0 bg-gradient-to-r', direction === 'OVER' ? 'from-success/70 to-success' : 'from-success to-success/70')} style={direction === 'OVER' ? { left: `${targetPct}%`, right: 0 } : { left: 0, width: `${targetPct}%` }} />
              <div className={cn('absolute inset-y-0 bg-danger/50')} style={direction === 'OVER' ? { left: 0, width: `${targetPct}%` } : { left: `${targetPct}%`, right: 0 }} />
            </div>
            {/* target marker */}
            <div className="pointer-events-none absolute top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `calc(${targetPct}% * (100% - 16px) / 100% + 8px)` }}>
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold tabular text-text">{fmtRoll(target)}</span>
              <span className="h-2 w-px bg-border-strong" />
            </div>
            {/* roll marker */}
            {last && (
              <motion.div
                className="pointer-events-none absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                initial={{ left: '8px', opacity: 0 }}
                animate={{ left: `calc(${last.roll / 100}% * (100% - 16px) / 100% + 8px)`, opacity: 1 }}
                transition={{ duration: 0.9, ease: [0.2, 0.9, 0.2, 1] }}
                data-testid="dice-marker"
              >
                <span className={cn('h-2 w-px', resultWon ? 'bg-success' : 'bg-danger')} />
                <span className={cn('size-3 rotate-45 rounded-[2px] border-2 border-bg', resultWon ? 'bg-success shadow-[0_0_12px_rgba(58,210,140,0.9)]' : 'bg-danger shadow-[0_0_12px_rgba(255,92,122,0.9)]')} />
              </motion.div>
            )}
            <div className="mt-1 flex justify-between px-0 text-[10px] text-muted-2 tabular">
              <span>0.00</span>
              <span>25.00</span>
              <span>50.00</span>
              <span>75.00</span>
              <span>99.99</span>
            </div>
          </div>

          {/* Controls */}
          <div className="relative grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="inline-flex rounded-lg border border-border bg-surface p-1" role="group" aria-label="Roll direction">
              {(['UNDER', 'OVER'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  data-testid={`dice-direction-${d.toLowerCase()}`}
                  aria-pressed={direction === d}
                  disabled={busy}
                  onClick={() => { setDirection(d); sound.play('click'); }}
                  className={cn('h-9 rounded-md px-4 text-xs font-bold uppercase tracking-wider transition-all focus-ring', direction === d ? 'bg-purple text-white shadow-[0_6px_18px_-8px_rgba(109,61,245,0.9)]' : 'text-muted hover:text-text')}
                >
                  Roll {d.toLowerCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Slider data-testid="dice-target" min={config.minTarget} max={config.maxTarget} step={1} value={[target]} onValueChange={([v]) => v !== undefined && setTarget(v)} disabled={busy} aria-label="Target" />
              <Input type="number" inputMode="decimal" className="w-24 text-right tabular" min={config.minTarget / 100} max={config.maxTarget / 100} step={0.01} value={fmtRoll(target)} disabled={busy} onChange={(e) => { const v = Math.round(Number.parseFloat(e.target.value) * 100); if (Number.isFinite(v)) setTarget(Math.max(config.minTarget, Math.min(config.maxTarget, v))); }} aria-label="Target value" />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2" data-testid="dice-preview">
            <div className="rounded-lg border border-border bg-surface/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-2">Win chance</p>
              <p className="text-lg font-bold text-cyan tabular">{(pv.chanceBp / 100).toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-border bg-surface/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-2">Multiplier</p>
              <p className="text-lg font-bold text-violet tabular" data-testid="dice-multiplier">{formatMultiplier(pv.multiplierBp)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-2">Payout on win</p>
              <p className="text-lg font-bold text-gold-2 tabular">{credits(potentialWin)}</p>
            </div>
            <p className="col-span-3 text-[11px] text-muted-2">Preview only — the server recomputes chance and multiplier for every roll (house edge {(config.houseEdgeBp / 100).toFixed(2)}%).</p>
          </div>
        </div>

        <Panel title="Recent rolls">
          {history.length === 0 ? (
            <p className="text-sm text-muted-2">No rolls yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" data-testid="dice-history">
              {history.map((h) => (
                <span key={h.id} title={`${h.won ? 'Won' : 'Lost'} · ${formatMultiplier(h.multiplierBp)} · stake ${credits(h.stakeMinor)}`} className={cn('rounded-md border px-2 py-1 text-xs font-semibold tabular', h.won ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger')}>
                  {fmtRoll(h.roll)}
                </span>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Session statistics">
          <SessionStatsGrid stats={stats.data} />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Bet" className="lg:sticky lg:top-20">
          <div className="space-y-4">
            <div>
              <LabelRow label="Bet amount" hint={`${credits(game.minBetMinor)} – ${credits(game.maxBetMinor)}`} />
              <div className="mt-2 flex gap-1.5">
                <Input data-testid="dice-bet" type="number" inputMode="decimal" min={minorToCredits(game.minBetMinor)} max={minorToCredits(game.maxBetMinor)} step={0.01} value={betText} disabled={busy} onChange={(e) => setBetText(e.target.value)} onBlur={() => setBetText(minorToCredits(Math.max(0, betMinor)).toFixed(2))} className="tabular" aria-label="Bet amount" />
                <AmountChip onClick={() => setBetMinor(betMinor / 2)} disabled={busy} testId="dice-bet-half">½</AmountChip>
                <AmountChip onClick={() => setBetMinor(betMinor * 2)} disabled={busy} testId="dice-bet-double">×2</AmountChip>
                <AmountChip onClick={() => setBetMinor(maxBet)} disabled={busy} testId="dice-bet-max">Max</AmountChip>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {config.betOptionsMinor.map((b) => (
                  <AmountChip key={b} active={betMinor === b} disabled={busy} onClick={() => { setBetMinor(b); sound.play('click'); }} testId="dice-bet-option">
                    {credits(b)}
                  </AmountChip>
                ))}
              </div>
            </div>
            <Button variant="gold" size="xl" className="w-full text-base tracking-wide" data-testid="dice-roll" disabled={!canRoll} onClick={() => void roll()}>
              {busy ? 'Rolling…' : insufficient ? 'Insufficient balance' : invalidBet ? 'Enter a valid bet' : `Roll ${direction === 'OVER' ? 'over' : 'under'} ${fmtRoll(target)}`}
            </Button>
            <p className="text-center text-[11px] text-muted-2">Balance {wallet.data ? credits(wallet.data.balanceMinor) : '—'}</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
