'use client';
import type { GameSummaryDto } from '@spinharbor/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GameTile, GameTileSkeleton } from './game-tile';

export function SectionHeader({ title, href, icon, action }: { title: string; href?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        {icon && <span className="text-violet [&_svg]:size-5">{icon}</span>}
        {title}
      </h2>
      {action ??
        (href && (
          <Link href={href} className="text-sm font-medium text-muted hover:text-text">
            View all →
          </Link>
        ))}
    </div>
  );
}

export function GameCarousel({ title, games, href, icon, loading, emptyText = 'Nothing here yet.' }: { title: string; games?: GameSummaryDto[]; href?: string; icon?: ReactNode; loading?: boolean; emptyText?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  return (
    <section className="relative">
      <SectionHeader
        title={title}
        href={href}
        icon={icon}
        action={
          <div className="flex items-center gap-2">
            {href && (
              <Link href={href} className="hidden text-sm font-medium text-muted hover:text-text sm:block">
                View all
              </Link>
            )}
            <Button variant="outline" size="icon-sm" onClick={() => scroll(-1)} aria-label="Scroll left">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => scroll(1)} aria-label="Scroll right">
              <ChevronRight />
            </Button>
          </div>
        }
      />
      <div ref={ref} className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {loading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="w-[150px] shrink-0 sm:w-[170px]"><GameTileSkeleton /></div>)}
        {!loading && games?.length === 0 && <p className="py-6 text-sm text-muted">{emptyText}</p>}
        {games?.map((g) => (
          <div key={g.id} className="w-[150px] shrink-0 snap-start sm:w-[170px]">
            <GameTile game={g} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function GameGrid({ games, loading, className }: { games?: GameSummaryDto[]; loading?: boolean; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6', className)}>
      {loading && Array.from({ length: 12 }).map((_, i) => <GameTileSkeleton key={i} />)}
      {games?.map((g) => (
        <GameTile key={g.id} game={g} />
      ))}
    </div>
  );
}
