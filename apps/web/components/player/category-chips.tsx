'use client';
import type { GameCategoryDto } from '@spinharbor/contracts';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

interface Props {
  categories?: GameCategoryDto[];
  loading?: boolean;
  active?: string | null;
  /** When provided, chips become buttons (lobby filter); otherwise they link to /casino?category=slug. */
  onSelect?: (slug: string | null) => void;
  showAll?: boolean;
  className?: string;
}

const chip = 'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors focus-ring';
const idle = 'border-border bg-surface text-muted hover:border-border-strong hover:text-text';
const on = 'border-violet/60 bg-purple/20 text-text shadow-[inset_0_0_0_1px_rgba(155,107,255,0.25)]';

export function CategoryChips({ categories, loading, active = null, onSelect, showAll = true, className }: Props) {
  if (loading) {
    return (
      <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
    );
  }
  const items = [...(showAll ? [{ slug: '', name: 'All', gameCount: undefined as number | undefined }] : []), ...(categories ?? []).map((c) => ({ slug: c.slug, name: c.name, gameCount: c.gameCount }))];
  return (
    <div className={cn('no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1', className)} role={onSelect ? 'tablist' : undefined}>
      {items.map((c) => {
        const isActive = (active ?? '') === c.slug;
        const testId = `category-filter-${c.slug || 'all'}`;
        const label = (
          <>
            {c.name}
            {typeof c.gameCount === 'number' && <span className={cn('rounded-full px-1.5 text-[10px] tabular', isActive ? 'bg-violet/25 text-violet' : 'bg-surface-3 text-muted-2')}>{c.gameCount}</span>}
          </>
        );
        if (onSelect) {
          return (
            <button key={c.slug || 'all'} type="button" role="tab" aria-selected={isActive} onClick={() => onSelect(c.slug || null)} className={cn(chip, isActive ? on : idle)} data-testid={testId}>
              {label}
            </button>
          );
        }
        return (
          <Link key={c.slug || 'all'} href={c.slug ? `/casino?category=${encodeURIComponent(c.slug)}` : '/casino'} className={cn(chip, isActive ? on : idle)} data-testid={testId}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
