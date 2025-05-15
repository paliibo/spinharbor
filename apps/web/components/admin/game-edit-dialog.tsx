'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminUpdateGameSchema, GameStatuses, Volatilities } from '@spinharbor/contracts';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAdminCategories, useUpdateGame, type AdminGameRow } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { creditsToMinor, minorToCredits } from '@/lib/format';
import { Checkbox, Field, NativeSelect } from './shared';

/** Form-facing variant of the contract schema: bet limits in credits, nullable strings as plain strings. */
const GameFormSchema = AdminUpdateGameSchema.omit({ minBetMinor: true, maxBetMinor: true, tagline: true, rtpLabel: true })
  .extend({
    name: z.string().min(2).max(60),
    tagline: z.string().max(80),
    description: z.string().min(10).max(2000),
    status: z.enum(GameStatuses),
    volatility: z.enum(Volatilities),
    rtpLabel: z.string().max(12),
    minBet: z.number({ error: 'Enter a min bet' }).positive('Must be > 0'),
    maxBet: z.number({ error: 'Enter a max bet' }).positive('Must be > 0'),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    sortOrder: z.number({ error: 'Enter a sort order' }).int(),
    categorySlugs: z.array(z.string()),
  })
  .refine((v) => v.minBet <= v.maxBet, { path: ['maxBet'], message: 'Max bet must be ≥ min bet' });
type GameForm = z.infer<typeof GameFormSchema>;

function toForm(g: AdminGameRow): GameForm {
  return { name: g.name, tagline: g.tagline ?? '', description: g.description, status: g.status, volatility: g.volatility, rtpLabel: g.rtpLabel ?? '', minBet: minorToCredits(g.minBetMinor), maxBet: minorToCredits(g.maxBetMinor), isFeatured: g.isFeatured, isNew: g.isNew, sortOrder: g.sortOrder, categorySlugs: g.categories.map((c) => c.slug) };
}

export function GameEditDialog({ game, onOpenChange }: { game: AdminGameRow | null; onOpenChange: (o: boolean) => void }) {
  const cats = useAdminCategories();
  const update = useUpdateGame();
  const form = useForm<GameForm>({ resolver: zodResolver(GameFormSchema) });
  useEffect(() => {
    if (game) form.reset(toForm(game));
  }, [game, form]);
  const err = form.formState.errors;
  return (
    <Dialog open={!!game} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="game-edit-dialog">
        {game && (
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const payload = AdminUpdateGameSchema.parse({
                name: v.name,
                tagline: v.tagline.trim() || null,
                description: v.description,
                status: v.status,
                volatility: v.volatility,
                rtpLabel: v.rtpLabel.trim() || null,
                minBetMinor: creditsToMinor(v.minBet),
                maxBetMinor: creditsToMinor(v.maxBet),
                isFeatured: v.isFeatured,
                isNew: v.isNew,
                sortOrder: v.sortOrder,
                categorySlugs: v.categorySlugs,
              });
              return update
                .mutateAsync({ id: game.id, ...payload })
                .then(() => {
                  toast.success(`${v.name} updated`);
                  onOpenChange(false);
                })
                .catch((e) => toast.error(errorMessage(e)));
            })}
          >
            <DialogHeader>
              <DialogTitle>Edit game</DialogTitle>
              <DialogDescription>
                <span className="font-mono text-xs">{game.slug}</span> · {game.provider.name} · {game.engine}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field label="Name" error={err.name?.message}>
                <Input {...form.register('name')} />
              </Field>
              <Field label="Tagline" error={err.tagline?.message}>
                <Input {...form.register('tagline')} placeholder="Short hook shown on tiles" />
              </Field>
              <Field label="Description" className="sm:col-span-2" error={err.description?.message}>
                <Textarea {...form.register('description')} rows={3} />
              </Field>
              <Field label="Status" error={err.status?.message}>
                <NativeSelect {...form.register('status')} data-testid="game-status-select">
                  {GameStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Volatility" error={err.volatility?.message}>
                <NativeSelect {...form.register('volatility')}>
                  {Volatilities.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="RTP label" error={err.rtpLabel?.message} hint="Display only, e.g. 96.1%">
                <Input {...form.register('rtpLabel')} />
              </Field>
              <Field label="Sort order" error={err.sortOrder?.message}>
                <Input type="number" step="1" {...form.register('sortOrder', { valueAsNumber: true })} />
              </Field>
              <Field label="Min bet (credits)" error={err.minBet?.message}>
                <Input type="number" step="0.01" min="0.01" {...form.register('minBet', { valueAsNumber: true })} />
              </Field>
              <Field label="Max bet (credits)" error={err.maxBet?.message}>
                <Input type="number" step="0.01" min="0.01" {...form.register('maxBet', { valueAsNumber: true })} />
              </Field>
              <div className="flex items-center gap-6 sm:col-span-2">
                <Controller control={form.control} name="isFeatured" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Featured</label>} />
                <Controller control={form.control} name="isNew" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> New</label>} />
              </div>
              <Field label="Categories" className="sm:col-span-2" error={err.categorySlugs?.message}>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
                  {(cats.data ?? []).map((c) => (
                    <Checkbox key={c.slug} label={c.name} value={c.slug} {...form.register('categorySlugs')} />
                  ))}
                  {cats.data?.length === 0 && <p className="text-xs text-muted-2">No categories defined.</p>}
                </div>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={update.isPending} data-testid="game-save">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
