'use client';
import { Clock3 } from 'lucide-react';
import Link from 'next/link';
import { GameGrid } from '@/components/game/game-carousel';
import { RequireAuth } from '@/components/layout/require-auth';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useRecent } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

export default function RecentPage() {
  return (
    <RequireAuth>
      <Recent />
    </RequireAuth>
  );
}

function Recent() {
  const recent = useRecent();
  const count = recent.data?.length ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Account" title="Recently played" description="Games from your latest sessions, most recent first." />
      {recent.isError ? (
        <EmptyState title="Could not load history" description={errorMessage(recent.error)} />
      ) : !recent.isLoading && count === 0 ? (
        <EmptyState icon={<Clock3 />} title="Nothing played yet" description="Open any SpinHarbor Original and play a round – it will appear here." action={<Button asChild><Link href="/casino/dice">Try Harbor Dice</Link></Button>} />
      ) : (
        <GameGrid games={recent.data} loading={recent.isLoading} />
      )}
    </div>
  );
}
