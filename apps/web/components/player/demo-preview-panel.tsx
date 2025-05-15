'use client';
import type { GameDetailDto } from '@spinharbor/contracts';
import { Clock, Eye, LogIn, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GameArtworkVisual } from '@/components/game/game-artwork';
import { Button } from '@/components/ui/button';

function statusNote(game: GameDetailDto): { icon: typeof Eye; title: string; text: string } {
  if (game.status === 'MAINTENANCE') return { icon: Wrench, title: 'Under maintenance', text: 'The operator has temporarily taken this game offline. It will return once maintenance completes.' };
  if (game.status === 'COMING_SOON') return { icon: Clock, title: 'Coming soon', text: 'This title is listed ahead of release. Gameplay will be enabled once the provider integration is certified.' };
  if (game.status === 'DISABLED') return { icon: Eye, title: 'Disabled', text: 'The operator has disabled this game. It stays in the catalogue for reference only.' };
  return { icon: Eye, title: 'Demo preview', text: `This catalogue entry comes from ${game.provider.name} and has no gameplay engine attached. It demonstrates how third-party content is listed, filtered and favourited without being playable.` };
}

/** Shown in place of the player for catalogue-only games and unavailable statuses. */
export function DemoPreviewPanel({ game }: { game: GameDetailDto }) {
  const note = statusNote(game);
  const Icon = note.icon;
  return (
    <section className="grid overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-[minmax(0,1fr)_320px]" data-testid="demo-preview">
      <div className="relative h-72 md:h-auto md:min-h-[420px]">
        <GameArtworkVisual art={game.artwork} size="lg" />
      </div>
      <div className="flex flex-col justify-center gap-4 p-6">
        <div className="flex size-12 items-center justify-center rounded-lg bg-surface-3 text-muted">
          <Icon className="size-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{note.title}</h2>
          <p className="mt-2 text-sm text-muted">{note.text}</p>
        </div>
        <p className="text-xs text-muted-2">Looking for something playable? Every SpinHarbor Original runs on a live engine.</p>
        <Button variant="secondary" asChild>
          <Link href="/casino?category=originals">Browse originals</Link>
        </Button>
      </div>
    </section>
  );
}

/** Playable game, but the visitor is not signed in. */
export function SignInToPlayPanel({ game }: { game: GameDetailDto }) {
  const pathname = usePathname();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface" data-testid="sign-in-to-play">
      <div className="relative h-80 sm:h-96">
        <GameArtworkVisual art={game.artwork} size="lg" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 p-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-purple text-white shadow-glow">
            <LogIn className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Sign in to play {game.name}</h2>
          <p className="max-w-sm text-sm text-muted">Outcomes are generated server-side against your demo wallet, so a session is required. New accounts start with 10,000 demo credits.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="gold" asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} data-testid="sign-in-to-play-cta">
                Sign in
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">Join free</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
