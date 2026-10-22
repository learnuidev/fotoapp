'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Play, Square } from 'lucide-react';
import type { FrontendState, Stage } from '@/lib/types';
import { StatusPill } from './status';

/**
 * The app, started against a stage.
 *
 * One button, and what it does is deliberately not obvious from the label: it writes
 * `apps/web/.env.local` from the stage's stacks, spawns the dev server with the same
 * values, and keeps the process. The panel below shows what the app printed, because a
 * dev server that failed to start says why in its own words.
 */
export function FrontendControls({ stages }: { stages: Stage[] }) {
  const [state, setState] = useState<(FrontendState & { responding?: boolean }) | null>(null);
  const [stage, setStage] = useState<Stage>(stages[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    const response = await fetch('/api/frontend', { cache: 'no-store' });
    if (response.ok) setState(await response.json());
  }, []);

  useEffect(() => {
    void read();
    const timer = window.setInterval(() => void read(), 3000);
    return () => window.clearInterval(timer);
  }, [read]);

  async function act(action: 'start' | 'stop') {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/frontend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, stage }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'That did not work');
      setState(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not work');
    } finally {
      setBusy(false);
      void read();
    }
  }

  const running = state?.status === 'running' || state?.status === 'starting';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          against
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as Stage)}
            disabled={running}
            className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground"
          >
            {stages.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        {running ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('stop')}
            className="inline-flex items-center gap-1.5 rounded-full border border-bad/40 bg-bad/10 px-3.5 py-1.5 text-sm text-bad hover:bg-bad/20 disabled:opacity-50"
          >
            <Square className="size-3.5" /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('start')}
            className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/15 px-3.5 py-1.5 text-sm text-ok hover:bg-ok/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Start the app
          </button>
        )}

        <StatusPill
          status={state?.status === 'running' ? 'ok' : state?.status === 'failed' ? 'bad' : 'idle'}
          label={state ? `${state.status}${state.stage ? ` · ${state.stage}` : ''}` : 'unknown'}
        />

        {state?.status === 'running' && (
          <a
            href={state.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            {state.url} <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>
      )}

      {state?.log && state.log.length > 0 && (
        <pre className="terminal no-scrollbar max-h-64 overflow-y-auto rounded-2xl border p-4 font-mono text-[11px] leading-relaxed">
          {state.log.join('\n')}
        </pre>
      )}
    </div>
  );
}
