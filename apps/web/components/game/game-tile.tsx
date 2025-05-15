'use client';
import type { GameSummaryDto } from '@spinharbor/contracts';
import { Heart, Play, Wrench, Clock, Eye } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '@/features/casino/use-casino';
import { useAuthStore } from '@/features/auth/auth-store';
import { GameArtworkVisual } from './game-artwork';

export function GameTile({ game, className, priority }: { game: GameSummaryDto; className?: string; priority?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const toggle = useToggleFavorite();
  const unavailable = game.status !== 'ACTIVE';
  return (
    <Link
      href={`/casino/games/${game.slug}`}
      className={cn('group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-violet/60 hover:shadow-glow focus-ring', className)}
      data-testid="game-tile"
      data-slug={game.slug}
    >
      <GameArtworkVisual art={game.artwork} size={priority ? 'lg' : 'md'} />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {game.isNew && <Badge variant="cyan">New</Badge>}
        {game.isFeatured && <Badge variant="gold">Featured</Badge>}
        {game.engine === 'DEMO_PREVIEW' && game.status === 'ACTIVE' && (
          <Badge variant="default">
            <Eye className="size-3" /> Preview
          </Badge>
        )}
        {game.status === 'MAINTENANCE' && (
          <Badge variant="warning">
            <Wrench className="size-3" /> Maintenance
          </Badge>
        )}
        {game.status === 'COMING_SOON' && (
          <Badge variant="cyan">
            <Clock className="size-3" /> Soon
          </Badge>
        )}
      </div>
      {user && (
        <button
          type="button"
          aria-label={game.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle.mutate(game.slug);
          }}
          className={cn('absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70', game.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        >
          <Heart className={cn('size-4', game.isFavorite && 'fill-danger text-danger')} />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="truncate text-sm font-semibold leading-tight">{game.name}</p>
        <p className="truncate text-[11px] text-muted">{game.provider.name}</p>
      </div>
      <div className={cn('absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100', unavailable && 'hidden')}>
        <span className="flex size-14 items-center justify-center rounded-full bg-purple text-white shadow-glow">
          <Play className="ml-0.5 size-6 fill-current" />
        </span>
      </div>
    </Link>
  );
}

export function GameTileSkeleton() {
  return <div className="aspect-[3/4] w-full animate-pulse-soft rounded-xl bg-surface-3" />;
}
