'use client';
import type { GameSort } from '@spinharbor/contracts';
import { Search, SearchX, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { GameGrid } from '@/components/game/game-carousel';
import { CategoryChips } from '@/components/player/category-chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/table';
import { useCategories, useGames, useProviders } from '@/features/casino/use-casino';
import { errorMessage } from '@/lib/api';

const SORTS: { value: GameSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'popular', label: 'Most played' },
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'Name A–Z' },
  { value: 'za', label: 'Name Z–A' },
];
const ALL = '__all__';
const PAGE_SIZE = 24;

export default function CasinoLobbyPage() {
  return (
    <Suspense fallback={<GameGrid loading />}>
      <Lobby />
    </Suspense>
  );
}

function Lobby() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const provider = params.get('provider') ?? '';
  const sort = (SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'featured') as GameSort;
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Local input state, debounced into ?search=.
  const [term, setTerm] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    // URL changed from outside (topbar search, back/forward): adopt it during render, not in an effect.
    setPrevSearch(search);
    setTerm(search);
  }
  useEffect(() => {
    if (term === search) return;
    const t = setTimeout(() => setParams({ search: term.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [term, search, setParams]);

  const query = useMemo(() => ({ search: search || undefined, category: category || undefined, provider: provider || undefined, sort, page, pageSize: PAGE_SIZE }), [search, category, provider, sort, page]);
  const games = useGames(query);
  const categories = useCategories();
  const providers = useProviders();
  const hasFilters = !!(search || category || provider);
  const total = games.data?.total ?? 0;

  return (
    <div>
      <PageHeader eyebrow="Casino" title="Game lobby" description="Every catalogue entry, filterable by category and provider. Only SpinHarbor Originals have a live engine; the rest are catalogue previews." />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search games, taglines or providers…" className="pl-9 pr-9" data-testid="lobby-search" aria-label="Search games" />
            {term && (
              <button type="button" onClick={() => setTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
            <Select value={provider || ALL} onValueChange={(v) => setParams({ provider: v === ALL ? null : v })}>
              <SelectTrigger data-testid="provider-filter" aria-label="Provider">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All providers</SelectItem>
                {providers.data?.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name} ({p.gameCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setParams({ sort: v === 'featured' ? null : v })}>
              <SelectTrigger data-testid="sort-select" aria-label="Sort">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CategoryChips categories={categories.data} loading={categories.isLoading} active={category || null} onSelect={(slug) => setParams({ category: slug })} />

        <div className="flex items-center justify-between text-sm text-muted">
          <p data-testid="result-count" aria-live="polite">
            {games.isLoading ? 'Loading games…' : `${total.toLocaleString()} ${total === 1 ? 'game' : 'games'}${hasFilters ? ' match your filters' : ''}`}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setTerm(''); setParams({ search: null, category: null, provider: null }); }}>
              <X /> Clear filters
            </Button>
          )}
        </div>

        {games.isError ? (
          <EmptyState icon={<SearchX />} title="Could not load games" description={errorMessage(games.error)} action={<Button variant="secondary" onClick={() => games.refetch()}>Retry</Button>} />
        ) : !games.isLoading && total === 0 ? (
          <div data-testid="lobby-empty">
            <EmptyState icon={<SearchX />} title="No games found" description={hasFilters ? 'Try another search term or clear the filters.' : 'The catalogue is empty.'} action={hasFilters ? <Button variant="secondary" onClick={() => { setTerm(''); setParams({ search: null, category: null, provider: null }); }}>Clear filters</Button> : undefined} />
          </div>
        ) : (
          <div className={games.isFetching && !games.isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <GameGrid games={games.data?.items} loading={games.isLoading} />
            <Pagination page={games.data?.page ?? page} totalPages={games.data?.totalPages ?? 1} onChange={(p) => { setParams({ page: p === 1 ? null : String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </div>
        )}
      </div>
    </div>
  );
}
