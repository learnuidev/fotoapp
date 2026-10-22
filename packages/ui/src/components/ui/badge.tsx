import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@ui/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground',
        // Each tone is a colour that has to read on paper and on darkness, so the
        // text is drawn twice: deep on the light theme, pale on the dark one.
        live: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        waiting: 'border-transparent bg-amber-500/20 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
        film: 'border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
