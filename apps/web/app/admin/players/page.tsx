'use client';
import { Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAdminPlayers, type AdminPlayerQuery } from '@/features/admin/use-admin';
import { Field, FilterBar, Money, NativeSelect, QueryState, RoleBadge, StatusBadge, TimeCell, useDebouncedInput, usePagedFilters } from '@/components/admin/shared';

const STATUSES = ['ACTIVE', 'SUSPENDED', 'COOLING_OFF', 'SELF_EXCLUDED', 'CLOSED'];
const ROLES = ['PLAYER', 'SUPPORT', 'OPERATOR', 'ADMIN'];

export default function AdminPlayersPage() {
  const router = useRouter();
  const { filters, page, setFilter, setPage } = usePagedFilters({ search: '', status: '', role: '', sort: 'newest' });
  const [search, setSearch] = useDebouncedInput((v) => setFilter('search', v));
  const q = useAdminPlayers({ ...filters, sort: filters.sort as AdminPlayerQuery['sort'], page, pageSize: 20 });

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Players" description="Search accounts, inspect wallets and risk, and manage account status." actions={q.data && <Badge variant="outline">{q.data.total.toLocaleString()} accounts</Badge>} />
      <FilterBar>
        <Field label="Search" className="min-w-[240px] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Username, email, display name or id" className="pl-9" data-testid="admin-player-search" />
          </div>
        </Field>
        <Field label="Status">
          <NativeSelect value={filters.status} onChange={(e) => setFilter('status', e.target.value)} data-testid="admin-player-status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Role">
          <NativeSelect value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Sort">
          <NativeSelect value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="balance">Highest balance</option>
            <option value="activity">Last active</option>
          </NativeSelect>
        </Field>
      </FilterBar>

      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={<Users />} title="No players match" description="Try a different search or clear the filters." />}>
        {(d) => (
          <>
            <Table data-testid="admin-players-table">
              <THead>
                <TR>
                  <TH>Player</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Tier</TH>
                  <TH className="text-right">Balance</TH>
                  <TH className="text-right">Rounds</TH>
                  <TH className="text-right">Flags</TH>
                  <TH>Last login</TH>
                </TR>
              </THead>
              <TBody>
                {d.items.map((p) => (
                  <TR key={p.id} className="cursor-pointer" onClick={() => router.push(`/admin/players/${p.id}`)} data-testid="player-row">
                    <TD>
                      <Link href={`/admin/players/${p.id}`} className="font-semibold hover:text-violet" onClick={(e) => e.stopPropagation()}>
                        {p.username}
                      </Link>
                      <p className="text-[11px] text-muted-2">{p.displayName}</p>
                    </TD>
                    <TD className="text-muted">{p.email}</TD>
                    <TD>
                      <RoleBadge role={p.role} />
                    </TD>
                    <TD>
                      <StatusBadge status={p.status} />
                      {p.statusUntil && (
                        <p className="text-[10px] text-muted-2">
                          until <TimeCell iso={p.statusUntil} />
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Badge variant="gold">{p.tier}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Money minor={p.balanceMinor} className="font-semibold" />
                      {p.bonusBalanceMinor > 0 && (
                        <p className="text-[11px] text-violet">
                          +<Money minor={p.bonusBalanceMinor} /> bonus
                        </p>
                      )}
                    </TD>
                    <TD className="text-right tabular">{p.rounds.toLocaleString()}</TD>
                    <TD className="text-right">{p.openRiskFlags > 0 ? <Badge variant="warning">{p.openRiskFlags}</Badge> : <span className="text-muted-2">0</span>}</TD>
                    <TD>
                      <TimeCell iso={p.lastLoginAt} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={d.totalPages} onChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}
