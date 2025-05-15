import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', {
  variants: {
    variant: {
      default: 'border-border-strong bg-surface-3 text-muted',
      purple: 'border-purple/40 bg-purple/15 text-violet',
      gold: 'border-gold/40 bg-gold/15 text-gold-2',
      cyan: 'border-cyan/40 bg-cyan/10 text-cyan',
      success: 'border-success/40 bg-success/10 text-success',
      danger: 'border-danger/40 bg-danger/10 text-danger',
      warning: 'border-warning/40 bg-warning/10 text-warning',
      outline: 'border-border-strong text-text',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Maps domain statuses to badge colours in one place. */
export function statusVariant(status: string): VariantProps<typeof badgeVariants>['variant'] {
  switch (status) {
    case 'ACTIVE':
    case 'OPERATIONAL':
    case 'SETTLED':
    case 'COMPLETED':
    case 'CASHED_OUT':
      return 'success';
    case 'SUSPENDED':
    case 'CLOSED':
    case 'DISABLED':
    case 'ERROR':
    case 'LOST':
    case 'FORFEITED':
    case 'HIGH':
      return 'danger';
    case 'COOLING_OFF':
    case 'MAINTENANCE':
    case 'NOT_CONFIGURED':
    case 'EXPIRED':
    case 'OPEN':
    case 'MEDIUM':
    case 'REVIEWED':
      return 'warning';
    case 'SELF_EXCLUDED':
    case 'VOIDED':
    case 'REFUNDED':
      return 'purple';
    case 'COMING_SOON':
    case 'PLACED':
    case 'LOW':
    case 'RUNNING':
      return 'cyan';
    default:
      return 'default';
  }
}
