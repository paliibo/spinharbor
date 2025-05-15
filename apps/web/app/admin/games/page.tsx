'use client';
import { Pencil, Power, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GameArtworkVisual } from '@/components/game/game-artwork';
import { useAdminGames, useStaffRole, useUpdateGame, type AdminGameRow } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { credits } from '@/lib/format';
import { CategoriesPanel } from '@/components/admin/categories-panel';
import { GameEditDialog } from '@/components/admin/game-edit-dialog';
import { EngineBadge, Money, QueryState, StatusBadge } from '@/components/admin/shared';

export default function AdminGamesPage() {
  const q = useAdminGames();
  const update = useUpdateGame();
  const { isOperator } = useStaffRole();
  const [editing, setEditing] = useState<AdminGameRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const patch = (g: AdminGameRow, body: Record<string, unknown>, label: string) => {
    setBusy(g.id);
    return update
      .mutateAsync({ id: g.id, ...body })
      .then(() => toast.success(`${g.name}: ${label}`))
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalogue" title="Games" description="Visibility, bet limits and merchandising flags for every title. Changes are audited." actions={q.data && <Badge variant="outline">{q.data.length} titles</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<Sparkles />} title="No games in the catalogue" />}>
          {(games) => (
            <Table data-testid="admin-games-table">
              <THead>
                <TR>
                  <TH>Game</TH>
                  <TH>Provider</TH>
                  <TH>Engine</TH>
                  <TH>Status</TH>
                  <TH>Featured</TH>
                  <TH>New</TH>
                  <TH>RTP</TH>
                  <TH className="text-right">Min / max</TH>
                  <TH className="text-right">Rounds 7d</TH>
                  <TH className="text-right">GGR 7d</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {games.map((g) => {
                  const enabled = g.status === 'ACTIVE';
                  const rowBusy = busy === g.id;
                  return (
                    <TR key={g.id} data-testid="game-row" data-slug={g.slug}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-border">
                            <GameArtworkVisual art={g.artwork} size="sm" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold">{g.name}</p>
                            <p className="truncate text-[11px] text-muted-2">
                              {g.slug} · {g.categories.map((c) => c.name).join(', ') || 'uncategorised'}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-muted">{g.provider.name}</TD>
                      <TD>
                        <EngineBadge engine={g.engine} />
                      </TD>
                      <TD>
                        <StatusBadge status={g.status} />
                        {!g.playable && g.status === 'ACTIVE' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1 text-[10px] text-warning">stub</span>
                            </TooltipTrigger>
                            <TooltipContent>Provider adapter is a stub – not playable</TooltipContent>
                          </Tooltip>
                        )}
                      </TD>
                      <TD>
                        <Switch checked={g.isFeatured} disabled={!isOperator || rowBusy} onCheckedChange={(v) => patch(g, { isFeatured: v }, v ? 'featured' : 'unfeatured')} aria-label="Featured" />
                      </TD>
                      <TD>
                        <Switch checked={g.isNew} disabled={!isOperator || rowBusy} onCheckedChange={(v) => patch(g, { isNew: v }, v ? 'marked new' : 'unmarked new')} aria-label="New" />
                      </TD>
                      <TD className="tabular text-muted">{g.rtpLabel ?? '—'}</TD>
                      <TD className="text-right tabular text-muted">
                        {credits(g.minBetMinor)} / {credits(g.maxBetMinor)}
                      </TD>
                      <TD className="text-right tabular">{g.rounds7d.toLocaleString()}</TD>
                      <TD className="text-right">
                        <Money minor={g.ggr7dMinor} sign colored />
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant={enabled ? 'ghost' : 'success'} disabled={!isOperator} loading={rowBusy} onClick={() => patch(g, { status: enabled ? 'DISABLED' : 'ACTIVE' }, enabled ? 'disabled' : 'enabled')} data-testid="game-toggle">
                            <Power /> {enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="outline" disabled={!isOperator} onClick={() => setEditing(g)} data-testid="game-edit">
                            <Pencil /> Edit
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </QueryState>
        <CategoriesPanel />
      </div>
      <GameEditDialog game={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}
