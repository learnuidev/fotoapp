'use client';

import { Toaster as Sonner } from 'sonner';

/** Toasts, in this product's colours and away from a phone's thumb. */
function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-2xl text-sm',
          description: 'text-muted-foreground',
          actionButton: 'rounded-full bg-primary text-primary-foreground',
        },
      }}
    />
  );
}

export { Toaster };
