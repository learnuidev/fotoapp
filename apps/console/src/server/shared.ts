/**
 * State that outlives one route bundle.
 *
 * Next builds every route handler as its own bundle, and in development it runs them in
 * separate module instances — so a `Map` declared at the top of `runs.ts` is a *different*
 * Map depending on which route is asking. That is a bug with a confusing symptom: a run
 * starts, and the transcript endpoint says no such run ever existed.
 *
 * The fix is to hang the state off `globalThis`, which every bundle in the process
 * shares. One key per thing, all of them created once.
 */

interface SharedState {
  /** Runs by id, and the order they started in. See `runs.ts`. */
  runs: Map<string, unknown>;
  /** The managed dev server. See `frontend.ts`. */
  frontend: Record<string, unknown>;
}

const KEY = '__foto_console_state__';

export function sharedState(): SharedState {
  const store = globalThis as unknown as Record<string, SharedState | undefined>;
  if (!store[KEY]) store[KEY] = { runs: new Map(), frontend: {} };
  return store[KEY]!;
}
