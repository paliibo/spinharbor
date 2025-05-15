'use client';
import type { CrashConfig } from '@spinharbor/contracts';
import { Rocket, ShieldCheck, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCrash, type CrashPhase } from '@/features/games/use-crash';
import { useSessionStats } from '@/features/games/use-game-session';
import { useSound } from '@/features/games/use-sound';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits, creditsToMinor, formatMultiplier, minorToCredits } from '@/lib/format';
import { cn, relativeTime } from '@/lib/utils';
import type { GameComponentProps } from '../game-frame';
import { AmountChip, LabelRow, Panel, SessionStatsGrid } from '../shared';
import { CrashChart } from './crash-chart';

const PHASE_LABEL: Record<CrashPhase, string> = { OFFLINE: 'Reconnecting…', WAITING: 'Waiting', BETTING_OPEN: 'Betting open', RUNNING: 'Running', CRASHED: 'Crashed', SETTLED: 'Settled' };

function crashColor(bp: number) {
  return bp >= 100_000 ? 'border-gold/50 bg-gold/15 text-gold-2' : bp >= 20_000 ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger';
}

export function CrashGame({ session, game }: GameComponentProps) {
  const config = session.config as CrashConfig;
  const wallet = useWallet();
  const stats = useSessionStats(session.id);
  const sound = useSound();
  const crash = useCrash();
  const { round, phase, multiplierBp, elapsedMs, countdownMs, myBet, me } = crash;

  const [stakeText, setStakeText] = useState(() => minorToCredits(config.betOptionsMinor[1] ?? config.betOptionsMinor[0] ?? 100).toFixed(2));
  const [autoText, setAutoText] = useState('');
  const [cashoutClicked, setCashoutClicked] = useState<string | null>(null); // roundId guard against double clicks

  const stakeMinor = Math.max(0, creditsToMinor(Number.parseFloat(stakeText) || 0));
  const autoBp = autoText.trim() === '' ? undefined : Math.round((Number.parseFloat(autoText) || 0) * 10_000);
  const autoInvalid = autoBp !== undefined && (!Number.isFinite(autoBp) || autoBp < 10_100 || autoBp > config.maxMultiplierBp);
  const available = (wallet.data?.balanceMinor ?? 0) + (wallet.data?.bonusBalanceMinor ?? 0);
  const stakeInvalid = stakeMinor < game.minBetMinor || stakeMinor > game.maxBetMinor;
  const insufficient = wallet.data ? available < stakeMinor : false;
  const canBet = phase === 'BETTING_OPEN' && !myBet && !crash.placing && !stakeInvalid && !autoInvalid && !insufficient && crash.connected;
  const canCashout = phase === 'RUNNING' && myBet?.status === 'PLACED' && !crash.cashingOut && cashoutClicked !== round?.id && crash.connected;
  const livePayout = myBet ? Math.floor((myBet.stakeMinor * multiplierBp) / 10_000) : 0;

  const setStakeMinor = (m: number) => setStakeText(minorToCredits(Math.max(game.minBetMinor, Math.min(game.maxBetMinor, Math.round(m)))).toFixed(2));

  // Sounds on phase transitions and on my own outcomes.
  const prevPhase = useRef<CrashPhase>(phase);
  useEffect(() => {
    if (prevPhase.current === phase) return;
    if (phase === 'RUNNING') sound.play('spin');
    if (phase === 'CRASHED') sound.play(myBet?.status === 'LOST' ? 'lose' : 'crash');
    if (phase === 'BETTING_OPEN') sound.play('tick');
    prevPhase.current = phase;
  }, [phase, sound, myBet?.status]);
  const prevMyStatus = useRef(myBet?.status);
  useEffect(() => {
    if (myBet?.status === 'CASHED_OUT' && prevMyStatus.current === 'PLACED') sound.play(myBet.cashoutMultiplierBp && myBet.cashoutMultiplierBp >= 50_000 ? 'bigwin' : 'cashout');
    prevMyStatus.current = myBet?.status;
  }, [myBet?.status, myBet?.cashoutMultiplierBp, sound]);

  const place = useCallback(async () => {
    if (!canBet) return;
    sound.play('click');
    try {
      await crash.place(stakeMinor, autoBp);
    } catch {
      /* toasted */
    }
  }, [canBet, crash, stakeMinor, autoBp, sound]);

  const cashout = useCallback(async () => {
    if (!canCashout || !round) return;
    setCashoutClicked(round.id);
    try {
      await crash.cashout();
    } catch {
      setCashoutClicked(null);
    }
  }, [canCashout, round, crash]);

  const bets = useMemo(() => (round ? [...round.bets].sort((a, b) => (a.userId === me?.id ? -1 : b.userId === me?.id ? 1 : b.stakeMinor - a.stakeMinor)) : []), [round, me?.id]);
  const phaseVariant = phase === 'CRASHED' ? 'danger' : phase === 'BETTING_OPEN' ? 'cyan' : phase === 'OFFLINE' ? 'warning' : statusVariant(phase);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="crash-game">
      <div className="flex min-w-0 flex-col gap-4">
        {!crash.connected && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="status" data-testid="crash-reconnecting">
            <WifiOff className="size-4" /> Reconnecting to the live feed…
          </div>
        )}

        <div className="card-surface relative overflow-hidden p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={phaseVariant} data-testid="crash-phase" data-phase={phase}>
                {phase === 'BETTING_OPEN' ? `Betting open · ${(countdownMs / 1000).toFixed(1)}s` : phase === 'CRASHED' && round?.crashMultiplierBp ? `Crashed at ${formatMultiplier(round.crashMultiplierBp)}` : PHASE_LABEL[phase]}
              </Badge>
              {round && <span className="text-xs text-muted-2 tabular">Round #{round.seq}</span>}
            </div>
            <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar" data-testid="crash-history" aria-label="Recent crash points">
              {crash.history.slice(0, 20).map((h) => (
                <span key={h.id} title={`#${h.seq} · ${relativeTime(h.crashedAt)}`} className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular', crashColor(h.crashMultiplierBp))}>
                  {formatMultiplier(h.crashMultiplierBp)}
                </span>
              ))}
            </div>
          </div>

          <CrashChart elapsedMs={elapsedMs} multiplierBp={multiplierBp} phase={phase} countdownMs={countdownMs} className="aspect-[2/1] min-h-48" />

          {myBet && (
            <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm', myBet.status === 'CASHED_OUT' ? 'border-success/40 bg-success/10' : myBet.status === 'LOST' ? 'border-danger/40 bg-danger/10' : 'border-cyan/40 bg-cyan/10')} data-testid="crash-my-bet" data-status={myBet.status}>
              <span className="text-muted">
                Your bet <strong className="text-text tabular">{credits(myBet.stakeMinor)}</strong>
                {myBet.autoCashoutBp ? <span className="ml-2 text-xs">auto @ {formatMultiplier(myBet.autoCashoutBp)}</span> : null}
              </span>
              {myBet.status === 'PLACED' && phase === 'RUNNING' && (
                <span className="font-semibold text-cyan tabular">
                  {formatMultiplier(multiplierBp)} → {credits(livePayout)}
                </span>
              )}
              {myBet.status === 'PLACED' && phase !== 'RUNNING' && <span className="text-xs text-muted">waiting for launch</span>}
              {myBet.status === 'CASHED_OUT' && (
                <span className="font-semibold text-success tabular">
                  Cashed out at {formatMultiplier(myBet.cashoutMultiplierBp ?? 0)} · +{credits(myBet.payoutMinor)}
                </span>
              )}
              {myBet.status === 'LOST' && <span className="font-semibold text-danger">Lost · crashed before cash-out</span>}
              {myBet.status === 'REFUNDED' && <span className="font-semibold text-violet">Refunded</span>}
            </div>
          )}
        </div>

        <Panel title={`Live bets · ${bets.length}`} bodyClassName="p-0">
          {bets.length === 0 ? (
            <p className="p-4 text-sm text-muted-2">No bets in this round yet.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto" data-testid="crash-live-bets">
              {bets.map((b) => (
                <li key={b.id} className={cn('flex items-center gap-3 px-4 py-2 text-xs', b.userId === me?.id && 'bg-purple/10')}>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {b.displayName}
                    {b.userId === me?.id && <span className="ml-1 text-violet">(you)</span>}
                  </span>
                  <span className="tabular text-muted">{credits(b.stakeMinor)}</span>
                  <span className="w-16 text-right tabular text-muted">{b.cashoutMultiplierBp ? formatMultiplier(b.cashoutMultiplierBp) : b.autoCashoutBp ? `auto ${formatMultiplier(b.autoCashoutBp)}` : '—'}</span>
                  <Badge variant={statusVariant(b.status)} className="w-24 justify-center">
                    {b.status === 'CASHED_OUT' ? `+${credits(b.payoutMinor)}` : b.status.replace('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
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
              <LabelRow label="Stake" hint={`${credits(game.minBetMinor)} – ${credits(game.maxBetMinor)}`} />
              <div className="mt-2 flex gap-1.5">
                <Input data-testid="crash-stake" type="number" inputMode="decimal" step={0.01} min={minorToCredits(game.minBetMinor)} max={minorToCredits(game.maxBetMinor)} value={stakeText} disabled={!!myBet && phase !== 'SETTLED'} onChange={(e) => setStakeText(e.target.value)} onBlur={() => setStakeText(minorToCredits(Math.max(0, stakeMinor)).toFixed(2))} className="tabular" aria-label="Stake" />
                <AmountChip onClick={() => setStakeMinor(stakeMinor / 2)} testId="crash-stake-half">½</AmountChip>
                <AmountChip onClick={() => setStakeMinor(stakeMinor * 2)} testId="crash-stake-double">×2</AmountChip>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {config.betOptionsMinor.map((b) => (
                  <AmountChip key={b} active={stakeMinor === b} onClick={() => { setStakeMinor(b); sound.play('click'); }} testId="crash-stake-option">
                    {credits(b)}
                  </AmountChip>
                ))}
              </div>
            </div>
            <div>
              <LabelRow label="Auto cash-out" hint="optional, min 1.01x" />
              <div className="relative mt-2">
                <Input data-testid="crash-auto-cashout" type="number" inputMode="decimal" step={0.01} min={1.01} placeholder="e.g. 2.00" value={autoText} onChange={(e) => setAutoText(e.target.value)} className={cn('pr-7 tabular', autoInvalid && 'border-danger')} aria-label="Auto cash-out multiplier" aria-invalid={autoInvalid} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-2">x</span>
              </div>
              {autoInvalid && <p className="mt-1 text-xs text-danger">Enter a multiplier of at least 1.01x.</p>}
            </div>

            <Button variant="primary" size="xl" className="w-full text-base tracking-wide" data-testid="crash-bet" disabled={!canBet} loading={crash.placing} onClick={() => void place()}>
              <Rocket />
              {myBet ? 'Bet placed' : phase === 'BETTING_OPEN' ? (insufficient ? 'Insufficient balance' : stakeInvalid ? 'Enter a valid stake' : `Place bet · ${credits(stakeMinor)}`) : phase === 'RUNNING' ? 'Round in progress' : 'Waiting for next round'}
            </Button>
            <Button variant="success" size="xl" className="w-full text-base tracking-wide" data-testid="crash-cashout" disabled={!canCashout} loading={crash.cashingOut} onClick={() => void cashout()}>
              {myBet?.status === 'PLACED' && phase === 'RUNNING' ? `Cash out · ${credits(livePayout)}` : 'Cash out'}
            </Button>
            <p className="text-center text-[11px] text-muted-2">Balance {wallet.data ? credits(wallet.data.balanceMinor) : '—'} · cash-out timing is validated on the server</p>
          </div>
        </Panel>

        <Panel title="My bets" bodyClassName="p-0">
          {crash.myBets.length === 0 ? (
            <p className="p-4 text-sm text-muted-2">No crash bets yet.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto" data-testid="crash-my-bets">
              {crash.myBets.slice(0, 20).map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-4 py-2 text-xs">
                  <span className="w-12 text-muted-2 tabular">#{b.roundSeq}</span>
                  <span className="tabular text-muted">{credits(b.stakeMinor)}</span>
                  <span className="flex-1 text-right tabular text-muted-2">{b.crashMultiplierBp ? `@ ${formatMultiplier(b.crashMultiplierBp)}` : ''}</span>
                  <span className={cn('w-20 text-right font-semibold tabular', b.status === 'CASHED_OUT' ? 'text-success' : b.status === 'LOST' ? 'text-danger' : 'text-muted')}>
                    {b.status === 'CASHED_OUT' ? `+${credits(b.payoutMinor)}` : b.status === 'LOST' ? `-${credits(b.stakeMinor)}` : b.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" /> Provably fair</span>}>
          <div className="space-y-2 text-xs" data-testid="crash-provably-fair">
            <div>
              <p className="text-muted-2">Seed hash (published before betting)</p>
              <p className="break-all font-mono text-[11px] text-text">{round?.serverSeedHash ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-2">Server seed (revealed after crash)</p>
              <p className="break-all font-mono text-[11px] text-text">{round?.serverSeed ?? 'hidden until the round crashes'}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-2">Crash point</span>
              <span className="font-semibold tabular">{round?.crashMultiplierBp ? formatMultiplier(round.crashMultiplierBp) : '—'}</span>
            </div>
            <p className="text-muted-2">
              The crash point is derived from the seed: r = first 52 bits of SHA-256(seed) as a fraction, crash = (1 − {(config.houseEdgeBp / 100).toFixed(0)}% edge) / (1 − r). Hash the revealed seed yourself to confirm it matches the hash published before bets opened. The multiplier follows m(t) = 2^(t / 10s); the server clock is authoritative for ticks and cash-outs.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
