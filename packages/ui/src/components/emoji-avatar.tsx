import { cn } from '@ui/lib/utils';

/**
 * A guest, drawn.
 *
 * There are no photographs of people anywhere in this product — a guest is a name
 * and an emoji, chosen on the join screen in two taps. That is a privacy decision
 * as much as a design one: nobody at the party has to upload a face to be in the
 * album, and the gallery still looks like people.
 */
export function EmojiAvatar({
  emoji,
  size = 'md',
  className,
  ring,
}: {
  emoji: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  ring?: boolean;
}) {
  const dimensions = {
    xs: 'size-6 text-xs',
    sm: 'size-8 text-base',
    md: 'size-10 text-lg',
    lg: 'size-14 text-2xl',
  }[size];

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-secondary/80 select-none',
        ring && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background',
        dimensions,
        className,
      )}
    >
      {emoji}
    </span>
  );
}
