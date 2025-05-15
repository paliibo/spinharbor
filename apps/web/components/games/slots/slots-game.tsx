'use client';
import type { GameRoundDto, SlotsConfig, SlotsRoundResult, SlotSymbol } from '@spinharbor/contracts';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlaySlots, useRoundHistory, useSessionStats } from '@/features/games/use-game-session';
import { useSound } from '@/features/games/use-sound';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GameComponentProps } from '../game-frame';
import { AmountChip, CountUpCredits, LabelRow, Panel, SessionStatsGrid } from '../shared';
import { PaytableDialog } from './paytable-dialog';
import { Reel, type ReelPhase } from './reel';
import { SYMBOL_META, SymbolIcon } from './symbol-icon';

const INITIAL_GRID: SlotSymbol[][] = [
  ['CHERRY', 'ANCHOR', 'LEMON'],
  ['GEM', 'SEVEN', 'BELL'],
  ['STAR', 'CROWN', 'CHERRY'],
  ['LEMON', 'GEM', 'SEVEN'],
  ['BELL', 'ANCHOR', 'CROWN'],
];
const MIN_SPIN_MS = 750;
const STOP_STAGGER_MS = 190;

interface SpinHistoryItem {
  id: string;
  betMinor: number;
  winMinor: number;
  at: string;
}

export function SlotsGame({ session, game }: GameComponentProps) {
  const config = session.config as SlotsConfig;
  const wallet = useWallet();
  const stats = useSessionStats(session.id);
  const rounds = useRoundHistory('SLOTS', 10);
  const play = usePlaySlots();
  const sound = useSound();

  const [bet, setBet] = useState<number>(() => config.betOptionsMinor[Math.min(2, config.betOptionsMinor.length - 1)] ?? config.betOptionsMinor[0]);
  const [grid, setGrid] = useState<SlotSymbol[][]>(INITIAL_GRID);
  const [phases, setPhases] = useState<ReelPhase[]>(() => Array(config.reels).fill('idle'));
  const [result, setResult] = useState<SlotsRoundResult | null>(null);
  const [resultPayout, setResultPayout] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [localHistory, setLocalHistory] = useState<SpinHistoryItem[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const available = (wallet.data?.balanceMinor ?? 0) + (wallet.data?.bonusBalanceMinor ?? 0);
  const insufficient = wallet.data ? available < bet : false;
  const canSpin = !spinning && !insufficient && !play.isPending;

  const highlights = useMemo(() => {
    const map = new Map<number, Set<number>>();
    if (!result) return map;
    for (const w of result.wins) for (const [reel, row] of w.positions) (map.get(reel) ?? map.set(reel, new Set()).get(reel)!).add(row);
    if (result.scatterWinMinor > 0) result.grid.forEach((col, reel) => col.forEach((s, row) => s === config.scatter && (map.get(reel) ?? map.set(reel, new Set()).get(reel)!).add(row)));
    return map;
  }, [result, config.scatter]);

  const spin = useCallback(async () => {
    if (!canSpin) return;
    setSpinning(true);
    setResult(null);
    setResultPayout(0);
    setPhases(Array(config.reels).fill('spinning'));
    sound.play('spin');
    const startedAt = Date.now();
    try {
      const res = await play.mutateAsync({ sessionId: session.id, betMinor: bet });
      const r = res.round.result;
      const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
      r.grid.forEach((col, reel) => {
        const t = window.setTimeout(() => {
          setGrid((g) => g.map((c, i) => (i === reel ? col : c)));
          setPhases((p) => p.map((ph, i) => (i === reel ? 'stopped' : ph)));
          sound.play('tick');
          if (reel === r.grid.length - 1) {
            setResult(r);
            setResultPayout(res.round.payoutMinor);
            setSpinning(false);
            setLocalHistory((h) => [{ id: res.round.id, betMinor: res.round.stakeMinor, winMinor: res.round.payoutMinor, at: res.round.createdAt }, ...h].slice(0, 10));
            if (res.round.payoutMinor >= res.round.stakeMinor * 10) sound.play('bigwin');
            else if (res.round.payoutMinor > 0) sound.play('win');
            else sound.play('lose');
          }
        }, wait + reel * STOP_STAGGER_MS);
        timers.current.push(t);
      });
    } catch {
      // The mutation already toasted the error; restore the reels.
      setPhases(Array(config.reels).fill('idle'));
      setSpinning(false);
    }
  }, [canSpin, config.reels, sound, play, session.id, bet]);

  // Keyboard: space to spin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        void spin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spin]);

  const history = useMemo<SpinHistoryItem[]>(() => {
    const server = (rounds.data?.items ?? []).map((r: GameRoundDto) => ({ id: r.id, betMinor: r.stakeMinor, winMinor: r.payoutMinor, at: r.createdAt }));
    const seen = new Set<string>();
    return [...localHistory, ...server].filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true))).slice(0, 10);
  }, [localHistory, rounds.data]);

  const anyWin = !!result && (result.wins.length > 0 || result.scatterWinMinor > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="slots-game">
      <style>{`@keyframes sh-reel-spin{from{transform:translateY(0)}to{transform:translateY(-50%)}}.sh-reel-strip{animation:sh-reel-spin .55s linear infinite}`}</style>
      <div className="flex flex-col gap-4">
        <div className="card-surface relative overflow-hidden p-3 sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(109,61,245,0.14),transparent_55%)]" />
          <div className="relative flex items-center justify-between pb-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex size-2 rounded-full bg-gold shadow-[0_0_8px_rgba(212,168,75,0.9)]" />
              {config.paylines.length} paylines · wild {SYMBOL_META[config.wild].label.split(' ')[0]} · scatter {SYMBOL_META[config.scatter].label.split(' ')[0]}
            </div>
            <PaytableDialog config={config} />
          </div>
          <div className="relative rounded-xl border border-border-strong bg-black/40 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_60px_-30px_rgba(109,61,245,0.6)] sm:p-3" data-testid="slots-result" data-spinning={spinning ? 'true' : 'false'} data-grid={spinning ? undefined : grid.map((c) => c.join(',')).join('|')}>
            <div className="flex gap-1.5 sm:gap-2.5">
              {grid.map((col, reel) => (
                <Reel key={reel} index={reel} symbols={col} phase={phases[reel] ?? 'idle'} highlight={highlights.get(reel) ?? new Set()} anyWin={anyWin} />
              ))}
            </div>
            {/* center payline marker */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          </div>

          <div className="relative mt-3 min-h-14">
            <AnimatePresence mode="wait">
              {result && !spinning ? (
                anyWin ? (
                  <motion.div key="win" initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gold/40 bg-gradient-to-b from-gold/15 to-transparent px-4 py-3 text-center">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-2">
                      <Sparkles className="size-3.5" /> {resultPayout >= bet * 10 ? 'Big win' : 'You win'}
                    </span>
                    <span className="gold-text text-3xl font-black" data-testid="slots-win" data-win={String(resultPayout)}>
                      <CountUpCredits value={resultPayout} />
                    </span>
                    <span className="text-xs text-muted">
                      {result.wins.length} line win{result.wins.length === 1 ? '' : 's'}
                      {result.scatterWinMinor > 0 && ` · ${result.scatterCount}× scatter`} · {result.totalWinMultiplier}× bet
                    </span>
                  </motion.div>
                ) : (
                  <motion.div key="lose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-3 text-sm text-muted" data-testid="slots-win" data-win="0">
                    No win this spin{result.scatterCount > 0 && ` · ${result.scatterCount} scatter${result.scatterCount === 1 ? '' : 's'}`}
                  </motion.div>
                )
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-3 text-sm text-muted-2">
                  {spinning ? 'Spinning…' : 'Place your bet and spin. Space bar also spins.'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {result && !spinning && result.wins.length > 0 && (
            <ul className="relative mt-1 grid gap-1 sm:grid-cols-2" data-testid="slots-win-lines">
              {result.wins.map((w) => (
                <li key={`${w.lineIndex}-${w.symbol}`} className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs">
                  <SymbolIcon symbol={w.symbol} size={22} />
                  <span className="text-muted">
                    Line {w.lineIndex + 1} · {w.count}× {SYMBOL_META[w.symbol].label.split(' ')[0]}
                  </span>
                  <span className="ml-auto font-semibold text-gold-2 tabular">+{credits(w.winMinor)}</span>
                </li>
              ))}
              {result.scatterWinMinor > 0 && (
                <li className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs">
                  <SymbolIcon symbol={config.scatter} size={22} />
                  <span className="text-muted">{result.scatterCount}× scatter</span>
                  <span className="ml-auto font-semibold text-gold-2 tabular">+{credits(result.scatterWinMinor)}</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <Panel title="Session statistics">
          <SessionStatsGrid stats={stats.data} />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Bet" className="lg:sticky lg:top-20">
          <div className="space-y-4">
            <div>
              <LabelRow label="Bet per spin" hint={`${credits(game.minBetMinor)} – ${credits(game.maxBetMinor)}`} />
              <div className="mt-2 flex flex-wrap gap-1.5" data-testid="slots-bet" data-value={bet}>
                {config.betOptionsMinor.map((b) => (
                  <AmountChip key={b} testId="slots-bet-option" active={bet === b} disabled={spinning} onClick={() => { setBet(b); sound.play('click'); }}>
                    {credits(b)}
                  </AmountChip>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-muted">Total bet</span>
              <span className="font-bold tabular">{credits(bet)}</span>
            </div>
            <Button variant="gold" size="xl" className="w-full text-base tracking-wide" data-testid="slots-spin" disabled={!canSpin} onClick={() => void spin()}>
              {spinning ? 'Spinning…' : insufficient ? 'Insufficient balance' : 'Spin'}
            </Button>
            <p className="text-center text-[11px] text-muted-2">Balance {wallet.data ? credits(wallet.data.balanceMinor) : '—'}</p>
          </div>
        </Panel>

        <Panel title="Last spins" bodyClassName="p-0">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-muted-2">No spins yet.</p>
          ) : (
            <ul className="divide-y divide-border" data-testid="slots-history">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="text-muted">Bet {credits(h.betMinor)}</span>
                  <span className={cn('font-semibold tabular', h.winMinor > 0 ? 'text-success' : 'text-muted-2')}>{h.winMinor > 0 ? `+${credits(h.winMinor)}` : '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
