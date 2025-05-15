'use client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAdminRiskFlags, useStaffRole, type AdminRiskFlag } from '@/features/admin/use-admin';
import { cn } from '@/lib/utils';
import { RiskReviewDialog } from '@/components/admin/risk-review-dialog';
import { CollapsibleJson, Field, FilterBar, NativeSelect, QueryState, StatusBadge, TimeCell, usePagedFilters } from '@/components/admin/shared';

export default function AdminRiskPage() {
  const { filters, page, setFilter, setPage } = usePagedFilters({ status: 'OPEN' });
  const status = filters.status;
  const q = useAdminRiskFlags({ status, page });
  const { isOperator } = useStaffRole();
  const [review, setReview] = useState<AdminRiskFlag | null>(null);
  return (
    <div>
      <PageHeader eyebrow="Compliance" title="Risk flags" description="Heuristic alerts raised by the risk engine (velocity, heavy loss, high stakes, shared devices). Review or dismiss with a note." actions={q.data && <Badge variant={status === 'OPEN' && q.data.total > 0 ? 'warning' : 'outline'}>{q.data.total.toLocaleString()} {status ? status.toLowerCase() : 'total'}</Badge>} />
      <FilterBar>
        <Field label="Status">
          <NativeSelect value={status} onChange={(e) => setFilter('status', e.target.value)} data-testid="risk-status-filter">
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="DISMISSED">Dismissed</option>
          </NativeSelect>
        </Field>
      </FilterBar>
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={<ShieldCheck />} title="No flags" description={status === 'OPEN' ? 'Nothing awaiting review.' : 'No flags with this status.'} />}>
        {(d) => (
          <>
            <Table data-testid="admin-risk-table">
              <THead>
                <TR>
                  <TH>Severity</TH>
                  <TH>Code</TH>
                  <TH>Player</TH>
                  <TH>Description</TH>
                  <TH>Status</TH>
                  <TH>Raised</TH>
                  <TH>Review</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {d.items.map((f) => (
                  <TR key={f.id} data-testid="risk-row" className={cn(f.status === 'OPEN' && f.severity === 'HIGH' && 'bg-danger/[0.04]')}>
                    <TD>
                      <StatusBadge status={f.severity} />
                    </TD>
                    <TD className="font-mono text-xs">{f.code}</TD>
                    <TD>
                      <Link href={`/admin/players/${f.userId}`} className="font-medium hover:text-violet" data-testid="risk-player-link">
                        {f.user.username}
                      </Link>
                      <div>
                        <StatusBadge status={f.user.status} className="text-[9px]" />
                      </div>
                    </TD>
                    <TD className="max-w-xs">
                      {f.description}
                      <CollapsibleJson value={f.metadata} label="details" />
                    </TD>
                    <TD>
                      <StatusBadge status={f.status} />
                    </TD>
                    <TD>
                      <TimeCell iso={f.createdAt} />
                    </TD>
                    <TD className="max-w-[220px] text-xs text-muted">
                      {f.reviewedBy ? (
                        <>
                          <span className="font-medium text-text">{f.reviewedBy.username}</span> · <TimeCell iso={f.reviewedAt} />
                          <p className="truncate">{f.resolution}</p>
                        </>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right">
                      {f.status === 'OPEN' && (
                        <Button size="sm" variant="outline" disabled={!isOperator} onClick={() => setReview(f)} data-testid="risk-review">
                          <ShieldAlert /> Review
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={d.totalPages} onChange={setPage} />
          </>
        )}
      </QueryState>
      <RiskReviewDialog flag={review} onOpenChange={(o) => !o && setReview(null)} />
    </div>
  );
}
