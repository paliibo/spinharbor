'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminCategorySchema } from '@spinharbor/contracts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useAdminCategories, useDeleteCategory, useStaffRole, useUpsertCategory, type AdminCategoryRow } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { ErrorCard, Field, Section } from './shared';

const CategoryFormSchema = AdminCategorySchema.omit({ description: true, icon: true, sortOrder: true }).extend({
  description: z.string().max(200),
  icon: z.string().max(40),
  sortOrder: z.number({ error: 'Enter a sort order' }).int(),
});
type CategoryForm = z.infer<typeof CategoryFormSchema>;

export function CategoriesPanel() {
  const cats = useAdminCategories();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();
  const { isOperator } = useStaffRole();
  const [editing, setEditing] = useState<AdminCategoryRow | 'new' | null>(null);
  const form = useForm<CategoryForm>({ resolver: zodResolver(CategoryFormSchema) });
  const err = form.formState.errors;

  const openEditor = (c: AdminCategoryRow | 'new') => {
    form.reset(c === 'new' ? { slug: '', name: '', description: '', icon: '', sortOrder: (cats.data?.length ?? 0) } : { slug: c.slug, name: c.name, description: c.description ?? '', icon: c.icon ?? '', sortOrder: c.sortOrder });
    setEditing(c);
  };

  return (
    <Section
      title="Categories"
      description="Lobby groupings. Deleting a category detaches its games."
      actions={
        isOperator && (
          <Button size="sm" variant="secondary" onClick={() => openEditor('new')} data-testid="category-add">
            <Plus /> Add
          </Button>
        )
      }
      bodyClassName="p-0"
    >
      {cats.isPending ? (
        <div className="p-4">
          <Skeleton className="h-32" />
        </div>
      ) : cats.isError ? (
        <div className="p-4">
          <ErrorCard error={cats.error} onRetry={() => cats.refetch()} />
        </div>
      ) : (
        <ul className="divide-y divide-border" data-testid="categories-list">
          {cats.data.map((c) => (
            <li key={c.slug} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-6 text-center text-[11px] tabular text-muted-2">{c.sortOrder}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name} <span className="ml-1 font-mono text-[11px] text-muted-2">{c.slug}</span>
                </p>
                {c.description && <p className="truncate text-xs text-muted">{c.description}</p>}
              </div>
              <Badge variant="outline">{c._count?.games ?? c.gameCount ?? 0} games</Badge>
              {isOperator && (
                <>
                  <Button size="icon-sm" variant="ghost" aria-label="Edit category" onClick={() => openEditor(c)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger"
                    aria-label="Delete category"
                    loading={del.isPending && del.variables === c.slug}
                    onClick={() => {
                      if (!window.confirm(`Delete category "${c.name}"? Games stay in the catalogue but lose this tag.`)) return;
                      del
                        .mutateAsync(c.slug)
                        .then(() => toast.success('Category deleted'))
                        .catch((e) => toast.error(errorMessage(e)));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
          {cats.data.length === 0 && <li className="p-6 text-center text-sm text-muted">No categories yet.</li>}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="category-dialog">
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) =>
              upsert
                .mutateAsync({ slug: v.slug, name: v.name, description: v.description.trim() || null, icon: v.icon.trim() || null, sortOrder: v.sortOrder })
                .then(() => {
                  toast.success('Category saved');
                  setEditing(null);
                })
                .catch((e) => toast.error(errorMessage(e))),
            )}
          >
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'New category' : 'Edit category'}</DialogTitle>
              <DialogDescription>Categories are upserted by slug.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Slug" error={err.slug?.message} hint="lowercase, digits and dashes">
                <Input {...form.register('slug')} disabled={editing !== 'new'} placeholder="table-games" className="font-mono" />
              </Field>
              <Field label="Name" error={err.name?.message}>
                <Input {...form.register('name')} />
              </Field>
              <Field label="Description" className="sm:col-span-2" error={err.description?.message}>
                <Input {...form.register('description')} />
              </Field>
              <Field label="Icon" error={err.icon?.message} hint="lucide icon name">
                <Input {...form.register('icon')} placeholder="cherry" />
              </Field>
              <Field label="Sort order" error={err.sortOrder?.message}>
                <Input type="number" step="1" {...form.register('sortOrder', { valueAsNumber: true })} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={upsert.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
