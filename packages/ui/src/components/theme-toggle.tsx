'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@ui/lib/utils';

/**
 * The switch between the two evenings.
 *
 * It renders nothing until it knows which theme is on, because the answer lives in
 * storage and is applied before hydration: drawing a sun for a page that is already
 * dark would be a flash of the wrong icon on every load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // A placeholder of the same size, so the header does not reflow when the button
    // appears a moment later.
    return <span className={cn('inline-block size-8', className)} aria-hidden />;
  }

  const dark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light' : 'Switch to dark'}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      className={cn(
        'inline-grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
