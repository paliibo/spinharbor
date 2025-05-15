'use client';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { GameGrid } from '@/components/game/game-carousel';
import { RequireAuth } from '@/components/layout/require-auth';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useFavorites } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <Favorites />
    </RequireAuth>
  );
}

function Favorites() {
  const favorites = useFavorites();
  const count = favorites.data?.length ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Account" title="Favourites" description={favorites.data ? `${count} saved ${count === 1 ? 'game' : 'games'}. Tap the heart on any tile to add or remove.` : 'Games you have hearted.'} />
      {favorites.isError ? (
        <EmptyState title="Could not load favourites" description={errorMessage(favorites.error)} />
      ) : !favorites.isLoading && count === 0 ? (
        <EmptyState icon={<Heart />} title="No favourites yet" description="Heart a game in the lobby and it will show up here for quick access." action={<Button asChild><Link href="/casino">Browse the lobby</Link></Button>} />
      ) : (
        <GameGrid games={favorites.data} loading={favorites.isLoading} />
      )}
    </div>
  );
}
