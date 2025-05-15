'use client';
import { Activity, Gamepad2, Trophy, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { GameCarousel } from '@/components/game/game-carousel';
import { GamePlayer } from '@/components/games/game-player';
import { DemoPreviewPanel, SignInToPlayPanel } from '@/components/player/demo-preview-panel';
import { Breadcrumb, GameDetailHeader } from '@/components/player/game-detail-header';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton, Stat } from '@/components/ui/misc';
import { useAuthStore } from '@/features/auth/auth-store';
import { useGame, useGames } from '@/features/casino/use-casino';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import Link from 'next/link';

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const game = useGame(slug);
  const firstCategory = game.data?.categories[0];
  const similar = useGames({ category: firstCategory?.slug, pageSize: 12, sort: 'popular' });
  const similarGames = similar.data?.items.filter((g) => g.slug !== slug);

  if (game.isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }
  if (game.isError || !game.data) {
    const notFound = game.error instanceof ApiRequestError && game.error.status === 404;
    return (
      <div>
        <Breadcrumb items={[{ label: 'Casino', href: '/casino' }, { label: 'Game' }]} />
        <EmptyState icon={<Gamepad2 />} title={notFound ? 'Game not found' : 'Could not load this game'} description={notFound ? 'That slug is not in the catalogue.' : errorMessage(game.error)} action={<Button variant="secondary" asChild><Link href="/casino">Back to lobby</Link></Button>} />
      </div>
    );
  }
  const g = game.data;
  const playable = g.playable && g.engine !== 'DEMO_PREVIEW' && g.status === 'ACTIVE';

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Casino', href: '/casino' }, ...(firstCategory ? [{ label: firstCategory.name, href: `/casino?category=${firstCategory.slug}` }] : []), { label: g.name }]} />
        <GameDetailHeader game={g} />
        {playable ? status !== 'ready' ? <Skeleton className="h-[420px] w-full rounded-2xl" /> : user ? <GamePlayer game={g} /> : <SignInToPlayPanel game={g} /> : <DemoPreviewPanel game={g} />}
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]" aria-label="About this game">
        <div className="card-surface p-5">
          <h2 className="text-base font-bold">About {g.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{g.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {g.categories.map((c) => (
              <Link key={c.slug} href={`/casino?category=${c.slug}`} className="rounded-full border border-border px-2.5 py-1 text-muted hover:border-border-strong hover:text-text">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Stat label="Rounds 24h" value={g.stats.rounds24h.toLocaleString()} hint={<span className="flex items-center gap-1"><Activity className="size-3" /> settled server-side</span>} accent="purple" />
          <Stat label="Players 24h" value={g.stats.players24h.toLocaleString()} hint={<span className="flex items-center gap-1"><Users className="size-3" /> unique accounts</span>} accent="cyan" />
          <Stat label="Biggest win 24h" value={credits(g.stats.biggestWinMinor)} hint={<span className="flex items-center gap-1"><Trophy className="size-3" /> demo credits</span>} accent="gold" />
        </div>
      </section>

      {firstCategory && (similar.isLoading || (similarGames?.length ?? 0) > 0) && <GameCarousel title="More like this" games={similarGames} loading={similar.isLoading} href={`/casino?category=${firstCategory.slug}`} />}
    </div>
  );
}
