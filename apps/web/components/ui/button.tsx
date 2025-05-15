import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-purple text-white hover:bg-purple-2 shadow-[0_8px_24px_-10px_rgba(109,61,245,0.8)]',
        gold: 'bg-gradient-to-b from-gold-2 to-gold text-[#1a1304] hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(212,168,75,0.7)]',
        secondary: 'bg-surface-3 text-text hover:bg-border-strong border border-border-strong',
        ghost: 'text-muted hover:text-text hover:bg-surface-3',
        outline: 'border border-border-strong text-text hover:bg-surface-3',
        danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
        success: 'bg-success text-[#03150c] hover:brightness-110',
        link: 'text-violet underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-10 px-4 [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        xl: 'h-14 px-8 text-lg [&_svg]:size-5',
        icon: 'size-10 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
export { buttonVariants };
