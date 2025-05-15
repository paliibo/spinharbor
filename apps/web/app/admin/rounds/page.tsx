'use client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';
import { useAdminGames, useAdminRounds } from '@/features/admin/use-admin';
import { Field, FilterBar, NativeSelect, usePagedFilters } from '@/components/admin/shared';
import { RoundsTable } from '@/components/admin/tables';

export default function AdminRoundsPage() {
  const { filters, page, setFilter, setPage } = usePagedFilters({ userId: '', gameSlug: '', engine: '', status: '' });
  const games = useAdminGames();
  const q = useAdminRounds({ ...filters, userId: filters.userId.trim(), page, pageSize: 25 });
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Rounds" description="Server-authoritative outcomes with their input, result payload, RNG commitment and linked journal entries." actions={q.data && <Badge variant="outline">{q.data.total.toLocaleString()} rounds</Badge>} />
      <FilterBar>
        <Field label="User id" className="min-w-[260px]">
          <Input value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} placeholder="uuid" className="font-mono text-xs" data-testid="rounds-user-filter" />
        </Field>
        <Field label="Game">
          <NativeSelect value={filters.gameSlug} onChange={(e) => setFilter('gameSlug', e.target.value)} data-testid="rounds-game-filter">
            <option value="">All games</option>
            {(games.data ?? []).map((g) => (
              <option key={g.id} value={g.slug}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Engine">
          <NativeSelect value={filters.engine} onChange={(e) => setFilter('engine', e.target.value)} data-testid="rounds-engine-filter">
            <option value="">All engines</option>
            {['SLOTS', 'DICE', 'ROULETTE', 'CRASH'].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status">
          <NativeSelect value={filters.status} onChange={(e) => setFilter('status', e.target.value)} data-testid="rounds-status-filter">
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="SETTLED">Settled</option>
            <option value="VOIDED">Voided</option>
          </NativeSelect>
        </Field>
      </FilterBar>
      <RoundsTable query={q} page={page} onPage={setPage} />
    </div>
  );
}
