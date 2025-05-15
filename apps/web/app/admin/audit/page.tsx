'use client';
import { FileSearch } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAdminAudit } from '@/features/admin/use-admin';
import { CollapsibleJson, Field, FilterBar, NativeSelect, QueryState, RoleBadge, ShortId, TimeCell, useDebouncedInput, usePagedFilters } from '@/components/admin/shared';

const TARGET_TYPES = ['user', 'game', 'category', 'provider', 'bonus_definition', 'promotion', 'risk_flag', 'journal_entry', 'settings'];

function targetHref(type: string | null, id: string | null) {
  if (!id) return null;
  if (type === 'user') return `/admin/players/${id}`;
  if (type === 'journal_entry') return `/admin/transactions/${id}`;
  return null;
}

export default function AdminAuditPage() {
  const { filters, page, setFilter, setPage } = usePagedFilters({ action: '', targetType: '', actorId: '' });
  const [action, setAction] = useDebouncedInput((v) => setFilter('action', v));
  const q = useAdminAudit({ ...filters, actorId: filters.actorId.trim(), page, pageSize: 25 });
  return (
    <div>
      <PageHeader eyebrow="Compliance" title="Audit log" description="Immutable record of staff actions and security events. Every mutation in this console lands here." actions={q.data && <Badge variant="outline">{q.data.total.toLocaleString()} entries</Badge>} />
      <FilterBar>
        <Field label="Action contains" className="min-w-[220px]">
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="player.status, game.update…" className="font-mono text-xs" data-testid="audit-action-filter" />
        </Field>
        <Field label="Target type">
          <NativeSelect value={filters.targetType} onChange={(e) => setFilter('targetType', e.target.value)} data-testid="audit-target-filter">
            <option value="">All</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Actor id" className="min-w-[260px]">
          <Input value={filters.actorId} onChange={(e) => setFilter('actorId', e.target.value)} placeholder="uuid" className="font-mono text-xs" data-testid="audit-actor-filter" />
        </Field>
      </FilterBar>
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={<FileSearch />} title="No audit entries" description="Try widening the filters." />}>
        {(d) => (
          <>
            <Table data-testid="admin-audit-table">
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Role</TH>
                  <TH>Action</TH>
                  <TH>Target</TH>
                  <TH>Metadata</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <TBody>
                {d.items.map((a) => {
                  const href = targetHref(a.targetType, a.targetId);
                  return (
                    <TR key={a.id} data-testid="audit-row">
                      <TD>
                        <TimeCell iso={a.createdAt} />
                      </TD>
                      <TD>
                        {a.actor ? (
                          <button type="button" className="font-medium hover:text-violet focus-ring rounded" onClick={() => setFilter('actorId', a.actorId ?? '')} title="Filter by this actor">
                            {a.actor.username}
                          </button>
                        ) : (
                          <span className="text-muted-2">system</span>
                        )}
                      </TD>
                      <TD>{a.actorRole ? <RoleBadge role={a.actorRole} /> : <span className="text-muted-2">—</span>}</TD>
                      <TD>
                        <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">{a.action}</code>
                      </TD>
                      <TD className="text-xs">
                        <span className="text-muted">{a.targetType ?? '—'}</span>{' '}
                        {a.targetId &&
                          (href ? (
                            <Link href={href} className="text-violet hover:underline">
                              <ShortId id={a.targetId} copy={false} />
                            </Link>
                          ) : (
                            <ShortId id={a.targetId} />
                          ))}
                      </TD>
                      <TD>
                        <CollapsibleJson value={a.metadata} />
                      </TD>
                      <TD className="font-mono text-xs text-muted-2">{a.ipAddress ?? '—'}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={d.totalPages} onChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}
