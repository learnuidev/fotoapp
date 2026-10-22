'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import type { Run, RunAction, Stage } from '@/lib/types';

/**
 * A `cdk` run, and the transcript it writes.
 *
 * The buttons do not wait for the run: starting one answers in a moment with a run id,
 * and the panel below polls for its output while it happens. That is what makes a six
 * minute `cdk deploy` a thing you can watch rather than a request that times out — and
 * the output is CloudFormation's own, not a summary this app invented, because on the
 * day something breaks the raw transcript is the only thing that says why.
 */
export function DeployControls({
  stage,
  size = 'default',
  actions = ['synth', 'diff', 'deploy'],
}: {
  stage: Stage;
  size?: 'default' | 'small';
  actions?: RunAction[];
}) {
  const [run, setRun] = useState<Run | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState<RunAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef(0);
  const scroller = useRef<HTMLPreElement | null>(null);

  const begin = useCallback(
    async (action: RunAction) => {
      setBusy(action);
      setError(null);
      setLines([]);
      cursor.current = 0;
      try {
        const response = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stage, action }),
        });
        const body = (await response.json()) as { run?: Run; error?: string };
        if (!response.ok || !body.run) throw new Error(body.error ?? 'Could not start that run');
        setRun(body.run);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not start that run');
      } finally {
        setBusy(null);
      }
    },
    [stage],
  );

  // Poll the run while it is going. One interval per run, cleared when it settles.
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/deploy/run?id=${run.id}&from=${cursor.current}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        lines: string[];
        next: number;
        status: Run['status'];
      };
      if (body.lines.length) {
        cursor.current = body.next;
        setLines((current) => [...current, ...body.lines]);
      }
      if (body.status !== 'running') {
        setRun((current) => (current ? { ...current, status: body.status } : current));
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [run]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy !== null || run?.status === 'running'}
            onClick={() => void begin(action)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50',
              action === 'deploy'
                ? 'border-ok/40 bg-ok/15 text-ok hover:bg-ok/25'
                : action === 'destroy'
                  ? 'border-bad/40 bg-bad/10 text-bad hover:bg-bad/20'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              size === 'small' ? 'px-3 py-1 text-xs' : '',
            ].join(' ')}
          >
            {busy === action ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {action}
          </button>
        ))}
        {run && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {run.action} · {run.status}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>
      )}

      {run && (
        <pre
          ref={scroller}
          className="no-scrollbar max-h-72 overflow-y-auto rounded-2xl border border-border bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground"
        >
          {`$ ${run.command}\n`}
          {lines.join('\n')}
          {run.status === 'running' ? '\n…' : ''}
        </pre>
      )}
    </div>
  );
}
