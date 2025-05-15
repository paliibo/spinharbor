'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Field } from './shared';

const ReasonSchema = z.object({ reason: z.string().trim().min(3, 'At least 3 characters').max(300, 'Max 300 characters') });
type ReasonForm = z.infer<typeof ReasonSchema>;

/** Confirmation dialog that collects an audited reason before a staff mutation. */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', variant = 'primary', pending, onConfirm, children, testId }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; confirmLabel?: string; variant?: 'primary' | 'danger' | 'gold' | 'success'; pending?: boolean; onConfirm: (reason: string) => Promise<unknown> | void; children?: React.ReactNode; testId?: string }) {
  const form = useForm<ReasonForm>({ resolver: zodResolver(ReasonSchema), defaultValues: { reason: '' } });
  useEffect(() => {
    if (!open) form.reset({ reason: '' });
  }, [open, form]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={testId}>
        <form
          onSubmit={form.handleSubmit(async (v) => {
            await onConfirm(v.reason);
          })}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <Field label="Reason (recorded in the audit log)" error={form.formState.errors.reason?.message}>
            <Textarea {...form.register('reason')} placeholder="Why is this action being taken?" autoFocus data-testid="reason-input" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={variant} loading={pending} data-testid="reason-confirm">
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
