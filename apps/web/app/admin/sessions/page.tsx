'use client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';
import { useAdminSessions } from '@/features/admin/use-admin';
import { Field, FilterBar, NativeSelect, usePagedFilters } from '@/components/admin/shared';
import { SessionsTable } from '@/components/admin/tables';

export default function AdminSessionsPage() {
  const { filters, page, setFilter, setPage } = usePagedFilters({ userId: '', status: '' });
  const q = useAdminSessions({ userId: filters.userId.trim(), status: filters.status, page, pageSize: 25 });
  return (
    <div>
      <PageHeader eyebrow="Operations" title="Game sessions" description="Every launch of a game creates a session; rounds are settled against it." actions={q.data && <Badge variant="outline">{q.data.total.toLocaleString()} sessions</Badge>} />
      <FilterBar>
        <Field label="User id" className="min-w-[280px]">
          <Input value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} placeholder="Filter by user id (uuid)" className="font-mono text-xs" data-testid="sessions-user-filter" />
        </Field>
        <Field label="Status">
          <NativeSelect value={filters.status} onChange={(e) => setFilter('status', e.target.value)} data-testid="sessions-status-filter">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="EXPIRED">Expired</option>
          </NativeSelect>
        </Field>
      </FilterBar>
      <SessionsTable query={q} page={page} onPage={setPage} />
    </div>
  );
}
