import type { StackState } from '@/lib/types';

/**
 * A state, as a dot and a word.
 *
 * Every status the console shows comes from one of these three ideas — done, in
 * progress, broken — and CloudFormation's vocabulary is longer than it is interesting,
 * so it is mapped once, here, rather than translated at each call site.
 */
export function StatusPill({
  status,
  label,
  className = '',
}: {
  status: 'ok' | 'warn' | 'bad' | 'idle';
  label: string;
  className?: string;
}) {
  const tone = {
    ok: 'text-ok border-ok/30 bg-ok/10',
    warn: 'text-warn border-warn/30 bg-warn/10',
    bad: 'text-bad border-bad/30 bg-bad/10',
    idle: 'text-muted-foreground border-border bg-muted/40',
  }[status];

  const dot = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-muted-foreground' }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** How a CloudFormation status reads on this console's three-point scale. */
export function stackTone(stack: StackState): 'ok' | 'warn' | 'bad' | 'idle' {
  if (stack.status === 'NOT_DEPLOYED') return 'idle';
  if (stack.status.endsWith('_IN_PROGRESS')) return 'warn';
  if (stack.status.endsWith('_COMPLETE') && !stack.status.startsWith('ROLLBACK')) return 'ok';
  return 'bad';
}

export function stackLabel(status: string): string {
  if (status === 'NOT_DEPLOYED') return 'not deployed';
  if (status === 'CREATE_COMPLETE') return 'created';
  if (status === 'UPDATE_COMPLETE') return 'updated';
  if (status === 'UPDATE_ROLLBACK_COMPLETE') return 'rolled back';
  return status.toLowerCase().replace(/_/g, ' ');
}
