'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminUpdateBonusSchema } from '@spinharbor/contracts';
import { Gift, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader, Progress } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { Pagination, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAdminBonusClaims, useAdminBonuses, useStaffRole, useUpdateBonus, type AdminBonusDefinition } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { credits, creditsToMinor, minorToCredits } from '@/lib/format';
import { Field, Money, QueryState, Section, StatusBadge, TimeCell } from '@/components/admin/shared';

/** Credits/percent-facing form schema derived from the contract; nulls = "not set". */
const BonusFormSchema = AdminUpdateBonusSchema.omit({ amountMinor: true, percentBp: true, maxAmountMinor: true }).extend({
  name: z.string().min(2).max(80),
  description: z.string().min(2).max(500),
  amount: z.number({ error: 'Enter an amount' }).min(0),
  percent: z.number().min(0).max(100).nullable(),
  maxAmount: z.number().positive().nullable(),
  wageringMultiplier: z.number({ error: 'Required' }).int().min(0).max(100),
  claimCooldownHours: z.number().int().positive().nullable(),
  maxClaimsPerUser: z.number().int().positive().nullable(),
  validForHours: z.number({ error: 'Required' }).int().positive(),
  isActive: z.boolean(),
});
type BonusForm = z.infer<typeof BonusFormSchema>;
const nullable = { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v)) };

function BonusEditDialog({ bonus, onOpenChange }: { bonus: AdminBonusDefinition | null; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateBonus();
  const form = useForm<BonusForm>({ resolver: zodResolver(BonusFormSchema) });
  useEffect(() => {
    if (bonus) form.reset({ name: bonus.name, description: bonus.description, amount: minorToCredits(bonus.amountMinor), percent: bonus.percentBp === null ? null : bonus.percentBp / 100, maxAmount: bonus.maxAmountMinor === null ? null : minorToCredits(bonus.maxAmountMinor), wageringMultiplier: bonus.wageringMultiplier, claimCooldownHours: bonus.claimCooldownHours, maxClaimsPerUser: bonus.maxClaimsPerUser, validForHours: bonus.validForHours, isActive: bonus.isActive });
  }, [bonus, form]);
  const err = form.formState.errors;
  return (
    <Dialog open={!!bonus} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="bonus-edit-dialog">
        {bonus && (
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const payload = AdminUpdateBonusSchema.parse({
                name: v.name,
                description: v.description,
                amountMinor: creditsToMinor(v.amount),
                percentBp: v.percent === null ? null : Math.round(v.percent * 100),
                maxAmountMinor: v.maxAmount === null ? null : creditsToMinor(v.maxAmount),
                wageringMultiplier: v.wageringMultiplier,
                claimCooldownHours: v.claimCooldownHours,
                maxClaimsPerUser: v.maxClaimsPerUser,
                validForHours: v.validForHours,
                isActive: v.isActive,
              });
              return update
                .mutateAsync({ id: bonus.id, ...payload })
                .then(() => {
                  toast.success(`${v.name} saved`);
                  onOpenChange(false);
                })
                .catch((e) => toast.error(errorMessage(e)));
            })}
          >
            <DialogHeader>
              <DialogTitle>Edit bonus</DialogTitle>
              <DialogDescription>
                <span className="font-mono text-xs">{bonus.code}</span> · {bonus.type.replace('_', ' ')}
                {bonus.requiredTier && ` · requires ${bonus.requiredTier}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field label="Name" error={err.name?.message} className="sm:col-span-2">
                <Input {...form.register('name')} />
              </Field>
              <Field label="Description" error={err.description?.message} className="sm:col-span-2">
                <Textarea {...form.register('description')} rows={2} />
              </Field>
              <Field label="Fixed amount (credits)" error={err.amount?.message} hint="0 for percentage-based bonuses">
                <Input type="number" step="0.01" min="0" {...form.register('amount', { valueAsNumber: true })} />
              </Field>
              <Field label="Percent of basis (%)" error={err.percent?.message} hint="Cashback: % of net losses. Blank = none">
                <Input type="number" step="0.01" min="0" max="100" {...form.register('percent', nullable)} />
              </Field>
              <Field label="Max amount (credits)" error={err.maxAmount?.message} hint="Cap for percentage bonuses. Blank = uncapped">
                <Input type="number" step="0.01" min="0.01" {...form.register('maxAmount', nullable)} />
              </Field>
              <Field label="Wagering multiplier (×)" error={err.wageringMultiplier?.message} hint="0 = credited straight to cash">
                <Input type="number" step="1" min="0" max="100" {...form.register('wageringMultiplier', { valueAsNumber: true })} />
              </Field>
              <Field label="Claim cooldown (hours)" error={err.claimCooldownHours?.message} hint="Blank = no cooldown">
                <Input type="number" step="1" min="1" {...form.register('claimCooldownHours', nullable)} />
              </Field>
              <Field label="Max claims per user" error={err.maxClaimsPerUser?.message} hint="Blank = unlimited">
                <Input type="number" step="1" min="1" {...form.register('maxClaimsPerUser', nullable)} />
              </Field>
              <Field label="Valid for (hours)" error={err.validForHours?.message}>
                <Input type="number" step="1" min="1" {...form.register('validForHours', { valueAsNumber: true })} />
              </Field>
              <div className="flex items-end pb-2">
                <Controller control={form.control} name="isActive" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Active (claimable)</label>} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={update.isPending} data-testid="bonus-save">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminBonusesPage() {
  const q = useAdminBonuses();
  const update = useUpdateBonus();
  const { isOperator } = useStaffRole();
  const [editing, setEditing] = useState<AdminBonusDefinition | null>(null);
  const [page, setPage] = useState(1);
  const claims = useAdminBonusClaims(page);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Promotions" title="Bonuses" description="Bonus definitions drive claims, wagering requirements and the BONUS_AWARD journal entries." />
      <Section title="Definitions" bodyClassName="p-0">
        <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<Gift />} title="No bonus definitions" />}>
          {(defs) => (
            <Table className="rounded-none border-0" data-testid="admin-bonuses-table">
              <THead>
                <TR>
                  <TH>Bonus</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Wagering</TH>
                  <TH>Rules</TH>
                  <TH className="text-right">Claims</TH>
                  <TH className="text-right">Total awarded</TH>
                  <TH>Active</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {defs.map((b) => (
                  <TR key={b.id} data-testid="bonus-row">
                    <TD>
                      <p className="font-semibold">{b.name}</p>
                      <p className="font-mono text-[11px] text-muted-2">{b.code}</p>
                    </TD>
                    <TD>
                      <Badge variant="purple">{b.type.replace('_', ' ')}</Badge>
                      {b.requiredTier && <Badge variant="gold" className="ml-1">{b.requiredTier}</Badge>}
                    </TD>
                    <TD className="text-right tabular">
                      {b.percentBp !== null ? (
                        <>
                          {b.percentBp / 100}%{b.maxAmountMinor !== null && <span className="text-muted"> ≤ {credits(b.maxAmountMinor)}</span>}
                        </>
                      ) : (
                        credits(b.amountMinor)
                      )}
                    </TD>
                    <TD className="tabular">{b.wageringMultiplier ? `${b.wageringMultiplier}×` : <span className="text-muted-2">none</span>}</TD>
                    <TD className="text-xs text-muted">
                      {b.claimCooldownHours ? `every ${b.claimCooldownHours}h` : b.maxClaimsPerUser ? `max ${b.maxClaimsPerUser}/user` : 'unlimited'} · valid {b.validForHours}h
                    </TD>
                    <TD className="text-right tabular">{b.claimCount.toLocaleString()}</TD>
                    <TD className="text-right">
                      <Money minor={b.totalAwardedMinor} />
                    </TD>
                    <TD>
                      <Switch checked={b.isActive} disabled={!isOperator || update.isPending} aria-label="Active" data-testid="bonus-active-toggle" onCheckedChange={(v) => update.mutateAsync({ id: b.id, isActive: v }).then(() => toast.success(`${b.name} ${v ? 'activated' : 'deactivated'}`)).catch((e) => toast.error(errorMessage(e)))} />
                    </TD>
                    <TD className="text-right">
                      <Button size="sm" variant="outline" disabled={!isOperator} onClick={() => setEditing(b)} data-testid="bonus-edit">
                        <Pencil /> Edit
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </QueryState>
      </Section>

      <Section title="Claims" description="Most recent first" bodyClassName="p-0">
        <QueryState query={claims} isEmpty={(d) => d.items.length === 0}>
          {(d) => (
            <>
              <Table className="rounded-none border-0" data-testid="admin-bonus-claims-table">
                <THead>
                  <TR>
                    <TH>Player</TH>
                    <TH>Bonus</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Wagering progress</TH>
                    <TH>Claimed</TH>
                    <TH>Expires</TH>
                    <TH>Entry</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.items.map((c) => {
                    const pct = c.wageringRequiredMinor ? Math.min(100, Math.round((c.wageringProgressMinor / c.wageringRequiredMinor) * 100)) : 100;
                    return (
                      <TR key={c.id} data-testid="bonus-claim-row">
                        <TD>
                          <Link href={`/admin/players/${c.userId}`} className="font-medium hover:text-violet">
                            {c.user.username}
                          </Link>
                        </TD>
                        <TD>
                          {c.definition.name} <span className="font-mono text-[11px] text-muted-2">{c.definition.code}</span>
                        </TD>
                        <TD>
                          <StatusBadge status={c.status} />
                        </TD>
                        <TD className="text-right">
                          <Money minor={c.amountMinor} />
                        </TD>
                        <TD className="min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5" />
                            <span className="tabular text-[11px] text-muted">{pct}%</span>
                          </div>
                        </TD>
                        <TD>
                          <TimeCell iso={c.claimedAt} />
                        </TD>
                        <TD>
                          <TimeCell iso={c.expiresAt} />
                        </TD>
                        <TD>
                          {c.journalEntryId ? (
                            <Link href={`/admin/transactions/${c.journalEntryId}`} className="font-mono text-xs text-violet hover:underline">
                              {c.journalEntryId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-muted-2">—</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <div className="px-4 pb-4">
                <Pagination page={page} totalPages={d.totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </QueryState>
      </Section>
      <BonusEditDialog bonus={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}
