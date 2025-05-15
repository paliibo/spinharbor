'use client';
import type { GameDetailDto, GameSessionDto } from '@spinharbor/contracts';
import { AlertTriangle, RefreshCw, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { errorCode, gameErrorMessage } from '@/features/games/errors';
import { useGameSession, useSessionStats } from '@/features/games/use-game-session';
import { useSound } from '@/features/games/use-sound';
import { useWallet } from '@/features/wallet/use-wallet';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';
import { netAccent } from './shared';

export interface GameComponentProps {
  game: GameDetailDto;
  session: GameSessionDto;
}

function SoundToggle() {
  const sound = useSound();
  const label = !sound.profileEnabled ? 'Sound is disabled in your profile settings' : sound.localEnabled ? 'Mute sounds' : 'Unmute sounds';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={label} aria-pressed={sound.enabled} data-testid="game-sound-toggle" onClick={sound.toggle} disabled={!sound.profileEnabled}>
          {sound.enabled ? <Volume2 /> : <VolumeX />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function HeaderStats({ sessionId }: { sessionId: string }) {
  const { data } = useSessionStats(sessionId);
  const s = data;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" data-testid="game-session-stats">
      <span>
        Rounds <strong className="text-text tabular">{s?.rounds ?? 0}</strong>
      </span>
      <span>
        W/L{' '}
        <strong className="text-text tabular">
          {s?.wins ?? 0}/{s?.losses ?? 0}
        </strong>
      </span>
      <span>
        Net{' '}
        <strong className={cn('tabular', netAccent(s?.netMinor ?? 0) === 'success' ? 'text-success' : netAccent(s?.netMinor ?? 0) === 'danger' ? 'text-danger' : 'text-text')}>
          {credits(s?.netMinor ?? 0, { sign: true })}
        </strong>
      </span>
    </div>
  );
}

/**
 * Shared chrome for every engine: opens/resumes the session, keeps the live wallet mounted, shows the
 * header (name, provider, session stats, sound toggle) and hands the session to the game.
 */
export function GameFrame({ game, children }: { game: GameDetailDto; children: (props: GameComponentProps) => ReactNode }) {
  const session = useGameSession(game.slug);
  const wallet = useWallet();

  return (
    <div className="flex flex-col gap-4" data-testid="game-frame" data-engine={game.engine}>
      <header className="card-surface flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold tracking-tight">{game.name}</h2>
            <Badge variant="purple">{game.engine}</Badge>
            {game.rtpLabel && <Badge variant="outline">RTP {game.rtpLabel}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {game.provider.name} · {game.volatility.toLowerCase()} volatility · bets {credits(game.minBetMinor)}–{credits(game.maxBetMinor)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {session.data ? <HeaderStats sessionId={session.data.id} /> : <Skeleton className="h-4 w-40" />}
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-2 tabular" data-testid="game-balance">
              {wallet.data ? credits(wallet.data.balanceMinor) : '—'}
            </div>
            <SoundToggle />
          </div>
        </div>
      </header>

      {session.isPending && (
        <div className="card-surface p-4" data-testid="game-session-loading">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Skeleton className="h-72 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      )}

      {session.isError && (
        <div className="card-surface flex flex-col items-center gap-3 p-8 text-center" data-testid="game-session-error">
          <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">{errorCode(session.error) === 'ACCOUNT_RESTRICTED' ? <ShieldAlert className="size-6" /> : <AlertTriangle className="size-6" />}</div>
          <div>
            <p className="font-semibold">{errorCode(session.error) === 'ACCOUNT_RESTRICTED' ? 'Play is restricted on your account' : 'Could not start the game session'}</p>
            <p className="mt-1 max-w-md text-sm text-muted">{gameErrorMessage(session.error)}</p>
          </div>
          <div className="flex gap-2">
            {errorCode(session.error) === 'ACCOUNT_RESTRICTED' ? (
              <Button asChild variant="gold">
                <Link href="/responsible-gaming">Responsible gaming</Link>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => session.refetch()} loading={session.isFetching}>
              <RefreshCw /> Retry
            </Button>
          </div>
        </div>
      )}

      {session.data && children({ game, session: session.data })}
    </div>
  );
}
