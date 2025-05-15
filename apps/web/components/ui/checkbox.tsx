'use client';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = React.forwardRef<React.ComponentRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={cn('peer flex size-5 shrink-0 items-center justify-center rounded border border-border-strong bg-surface transition-colors focus-ring data-[state=checked]:border-purple data-[state=checked]:bg-purple data-[state=checked]:text-white disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="size-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';
