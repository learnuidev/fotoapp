import { cn } from '@ui/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-2xl bg-muted/60', className)} {...props} />;
}

export { Skeleton };
