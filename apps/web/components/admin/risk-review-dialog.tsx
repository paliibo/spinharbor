'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminRiskReviewSchema } from '@spinharbor/contracts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { useReviewRiskFlag, type AdminRiskFlag } from '@/features/admin/use-admin';
import { errorMessage } from '@/lib/api';
import { Field, NativeSelect, StatusBadge } from './shared';

type ReviewForm = z.infer<typeof AdminRiskReviewSchema>;

export function RiskReviewDialog({ flag, onOpenChange }: { flag: AdminRiskFlag | null; onOpenChange: (o: boolean) => void }) {
  const review = useReviewRiskFlag();
  const form = useForm<ReviewForm>({ resolver: zodResolver(AdminRiskReviewSchema), defaultValues: { status: 'REVIEWED', resolution: '' } });
  useEffect(() => {
    if (flag) form.reset({ status: 'REVIEWED', resolution: '' });
  }, [flag, form]);
  return (
    <Dialog open={!!flag} onOpenChange={onOpenChange}>
      <DialogContent data-testid="risk-review-dialog">
        {flag && (
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) =>
              review
                .mutateAsync({ id: flag.id, ...v })
                .then(() => {
                  toast.success(`Flag ${v.status.toLowerCase()}`);
                  onOpenChange(false);
                })
                .catch((e) => toast.error(errorMessage(e))),
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Review risk flag <StatusBadge status={flag.severity} />
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono text-xs">{flag.code}</span> — {flag.description}
              </DialogDescription>
            </DialogHeader>
            <Field label="Outcome">
              <NativeSelect {...form.register('status')}>
                <option value="REVIEWED">Reviewed — concern confirmed / actioned</option>
                <option value="DISMISSED">Dismissed — false positive</option>
              </NativeSelect>
            </Field>
            <Field label="Resolution note" error={form.formState.errors.resolution?.message}>
              <Textarea {...form.register('resolution')} placeholder="What was checked and decided?" autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={review.isPending}>
                Save review
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
