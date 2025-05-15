'use client';
import type { GameDetailDto } from '@spinharbor/contracts';
import { ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/auth-store';
import { useToggleFavorite } from '@/features/casino/use-casino';
import { credits } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 text-muted-2" />}
          {it.href ? (
            <Link href={it.href} className="hover:text-text">
              {it.label}
            </Link>
          ) : (
            <span className="text-text" aria-current="page">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function GameDetailHeader({ game }: { game: GameDetailDto }) {
  const user = useAuthStore((s) => s.user);
  const toggle = useToggleFavorite();
  const volatilityVariant = game.volatility === 'HIGH' ? 'danger' : game.volatility === 'MEDIUM' ? 'warning' : 'cyan';
  return (
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl" data-testid="game-title">
            {game.name}
          </h1>
          {game.isNew && <Badge variant="cyan">New</Badge>}
          {game.isFeatured && <Badge variant="gold">Featured</Badge>}
          {game.status !== 'ACTIVE' && <Badge variant={statusVariant(game.status)}>{game.status.replace('_', ' ').toLowerCase()}</Badge>}
          {game.engine === 'DEMO_PREVIEW' && <Badge>Preview</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          by{' '}
          <Link href={`/casino?provider=${game.provider.code}`} className="font-medium text-violet hover:underline">
            {game.provider.name}
          </Link>
          {game.tagline && <span> · {game.tagline}</span>}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">RTP</dt>
            <dd className="font-semibold tabular">{game.rtpLabel ?? '—'}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Volatility</dt>
            <dd>
              <Badge variant={volatilityVariant}>{game.volatility.toLowerCase()}</Badge>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Bet</dt>
            <dd className="font-semibold tabular">
              {credits(game.minBetMinor)} – {credits(game.maxBetMinor)}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Played</dt>
            <dd className="font-semibold tabular">{game.playCount.toLocaleString()}×</dd>
          </div>
        </dl>
      </div>
      {user && (
        <Button variant={game.isFavorite ? 'secondary' : 'outline'} loading={toggle.isPending} onClick={() => toggle.mutate(game.slug)} aria-pressed={!!game.isFavorite} data-testid="favorite-toggle" className="shrink-0">
          <Heart className={cn(game.isFavorite && 'fill-danger text-danger')} />
          {game.isFavorite ? 'Favourited' : 'Add to favourites'}
        </Button>
      )}
    </header>
  );
}
