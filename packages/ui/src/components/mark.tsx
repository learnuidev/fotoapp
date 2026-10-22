import { cn } from '@ui/lib/utils';

/**
 * The wordmark.
 *
 * A bullet in a ring — the shutter seen from the front, which is the one image
 * every camera since the Brownie has used. It is drawn rather than set in a font
 * so it costs no request and stays crisp on a projector.
 */
export function Mark({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative grid size-8 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-violet-500">
        <span className="size-3 rounded-full bg-background/90" />
        <span className="absolute inset-1 rounded-full border border-white/30" />
      </span>
      {withWord && (
        <span className="font-display text-xl tracking-tight">
          foto<span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}
