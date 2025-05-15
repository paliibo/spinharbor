'use client';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as React from 'react';
import { avatarGradient, cn, initials } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse-soft rounded-md bg-surface-3', className)} {...props} />;
}

export const Separator = React.forwardRef<React.ComponentRef<typeof SeparatorPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root ref={ref} decorative={decorative} orientation={orientation} className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...props} />
));
Separator.displayName = 'Separator';

export const Progress = React.forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-3', className)} {...props}>
    <ProgressPrimitive.Indicator className={cn('h-full w-full flex-1 rounded-full bg-gradient-to-r from-purple to-violet transition-transform duration-500', indicatorClassName)} style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }} />
  </ProgressPrimitive.Root>
));
Progress.displayName = 'Progress';

export function Avatar({ seed, name, className, size = 36 }: { seed: string; name: string; className?: string; size?: number }) {
  return (
    <AvatarPrimitive.Root className={cn('relative flex shrink-0 overflow-hidden rounded-full', className)} style={{ width: size, height: size }}>
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center text-xs font-bold text-white" style={{ background: avatarGradient(seed), fontSize: size * 0.36 }}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center', className)}>
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-surface-3 text-muted [&_svg]:size-6">{icon}</div>}
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: 'gold' | 'cyan' | 'success' | 'danger' | 'purple'; className?: string }) {
  const color = accent === 'gold' ? 'text-gold-2' : accent === 'cyan' ? 'text-cyan' : accent === 'success' ? 'text-success' : accent === 'danger' ? 'text-danger' : accent === 'purple' ? 'text-violet' : 'text-text';
  return (
    <div className={cn('card-surface p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular', color)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-2">{hint}</p>}
    </div>
  );
}
