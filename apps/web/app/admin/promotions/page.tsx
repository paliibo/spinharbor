'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminUpdatePromotionSchema } from '@spinharbor/contracts';
import { Megaphone, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { useAdminPromotions, useStaffRole, useUpdatePromotion, type AdminPromotionRow } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ErrorCard, Field, TimeCell } from '@/components/admin/shared';

const PromoFormSchema = AdminUpdatePromotionSchema.omit({ subtitle: true, endsAt: true }).extend({
  title: z.string().min(2).max(80),
  subtitle: z.string().max(120),
  description: z.string().min(2).max(1000),
  ctaLabel: z.string().min(1).max(40),
  isActive: z.boolean(),
  sortOrder: z.number({ error: 'Enter a sort order' }).int(),
  endsAt: z.string(),
});
type PromoForm = z.infer<typeof PromoFormSchema>;

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Procedural banner – same palette/motif description the player lobby renders. */
function PromoBanner({ promo, className, title, subtitle, cta }: { promo: Pick<AdminPromotionRow, 'artwork' | 'isActive'>; className?: string; title: string; subtitle: string | null; cta: string }) {
  const [a, b, c] = promo.artwork.palette;
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border p-5', className)} style={{ background: `radial-gradient(120% 90% at 10% 10%, ${a} 0%, transparent 55%), radial-gradient(90% 80% at 90% 90%, ${c} 0%, transparent 50%), linear-gradient(160deg, ${b} 0%, #0b0b10 100%)` }} data-testid="promo-banner">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_80%_30%,#fff_0,transparent_40%)]" />
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div>
          <span className="rounded-full border border-white/20 bg-black/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/80">{promo.artwork.motif}</span>
          <h3 className="mt-2 text-lg font-extrabold tracking-tight text-white drop-shadow">{title}</h3>
          {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
        </div>
        <span className="inline-flex w-fit items-center rounded-md bg-gradient-to-b from-gold-2 to-gold px-3 py-1.5 text-xs font-semibold text-[#1a1304] shadow">{cta}</span>
      </div>
      {!promo.isActive && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold uppercase tracking-widest text-white/80">inactive</div>}
    </div>
  );
}

function PromoEditDialog({ promo, onOpenChange }: { promo: AdminPromotionRow | null; onOpenChange: (o: boolean) => void }) {
  const update = useUpdatePromotion();
  const form = useForm<PromoForm>({ resolver: zodResolver(PromoFormSchema) });
  useEffect(() => {
    if (promo) form.reset({ title: promo.title, subtitle: promo.subtitle ?? '', description: promo.description, ctaLabel: promo.ctaLabel, isActive: promo.isActive, sortOrder: promo.sortOrder, endsAt: toLocalInput(promo.endsAt) });
  }, [promo, form]);
  const err = form.formState.errors;
  const w = form.watch();
  return (
    <Dialog open={!!promo} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="promotion-edit-dialog">
        {promo && (
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const payload = AdminUpdatePromotionSchema.parse({ title: v.title, subtitle: v.subtitle.trim() || null, description: v.description, ctaLabel: v.ctaLabel, isActive: v.isActive, sortOrder: v.sortOrder, endsAt: v.endsAt ? new Date(v.endsAt) : null });
              return update
                .mutateAsync({ id: promo.id, ...payload, endsAt: payload.endsAt ? payload.endsAt.toISOString() : null })
                .then(() => {
                  toast.success('Promotion saved');
                  onOpenChange(false);
                })
                .catch((e) => toast.error(errorMessage(e)));
            })}
          >
            <DialogHeader>
              <DialogTitle>Edit promotion</DialogTitle>
              <DialogDescription>
                <span className="font-mono text-xs">{promo.slug}</span>
                {promo.bonusDefinition && ` · linked bonus ${promo.bonusDefinition.code}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 md:grid-cols-[1fr_260px]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" error={err.title?.message} className="sm:col-span-2">
                  <Input {...form.register('title')} />
                </Field>
                <Field label="Subtitle" error={err.subtitle?.message} className="sm:col-span-2">
                  <Input {...form.register('subtitle')} />
                </Field>
                <Field label="Description" error={err.description?.message} className="sm:col-span-2">
                  <Textarea {...form.register('description')} rows={3} />
                </Field>
                <Field label="CTA label" error={err.ctaLabel?.message}>
                  <Input {...form.register('ctaLabel')} />
                </Field>
                <Field label="Sort order" error={err.sortOrder?.message}>
                  <Input type="number" step="1" {...form.register('sortOrder', { valueAsNumber: true })} />
                </Field>
                <Field label="Ends at" error={err.endsAt?.message} hint="Blank = open-ended">
                  <Input type="datetime-local" {...form.register('endsAt')} />
                </Field>
                <div className="flex items-end pb-2">
                  <Controller control={form.control} name="isActive" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Active</label>} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Preview</p>
                <PromoBanner promo={{ artwork: promo.artwork, isActive: w.isActive ?? true }} title={w.title || promo.title} subtitle={w.subtitle || null} cta={w.ctaLabel || promo.ctaLabel} className="h-56" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={update.isPending} data-testid="promotion-save">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPromotionsPage() {
  const q = useAdminPromotions();
  const update = useUpdatePromotion();
  const { isOperator } = useStaffRole();
  const [editing, setEditing] = useState<AdminPromotionRow | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Promotions" title="Promotions" description="Lobby banners. Artwork is procedural – palette and motif only, no third-party assets." actions={q.data && <Badge variant="outline">{q.data.filter((p) => p.isActive).length} active</Badge>} />
      {q.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorCard error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No promotions" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="promotions-grid">
          {q.data.map((p) => (
            <article key={p.id} className="card-surface flex flex-col gap-3 p-4" data-testid="promotion-card">
              <PromoBanner promo={p} title={p.title} subtitle={p.subtitle} cta={p.ctaLabel} className="h-44" />
              <p className="line-clamp-3 text-sm text-muted">{p.description}</p>
              <dl className="grid grid-cols-2 gap-1 text-[11px] text-muted-2">
                <dt>Order</dt>
                <dd className="tabular text-text">{p.sortOrder}</dd>
                <dt>Bonus</dt>
                <dd className="font-mono text-text">{p.bonusDefinition?.code ?? '—'}</dd>
                <dt>Starts</dt>
                <dd className="text-text">{formatDate(p.startsAt, { dateStyle: 'medium' })}</dd>
                <dt>Ends</dt>
                <dd className="text-text">{p.endsAt ? <TimeCell iso={p.endsAt} /> : 'open-ended'}</dd>
              </dl>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <Switch checked={p.isActive} disabled={!isOperator || update.isPending} onCheckedChange={(v) => update.mutateAsync({ id: p.id, isActive: v }).then(() => toast.success(`${p.title} ${v ? 'activated' : 'deactivated'}`)).catch((e) => toast.error(errorMessage(e)))} aria-label="Active" />
                  Active
                </label>
                <Button size="sm" variant="outline" disabled={!isOperator} onClick={() => setEditing(p)} data-testid="promotion-edit">
                  <Pencil /> Edit
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <PromoEditDialog promo={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}
