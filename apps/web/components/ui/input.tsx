import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn('flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted-2 focus-ring focus-visible:border-violet disabled:cursor-not-allowed disabled:opacity-50', className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn('flex min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted-2 focus-ring focus-visible:border-violet', className)} ref={ref} {...props} />
));
Textarea.displayName = 'Textarea';
