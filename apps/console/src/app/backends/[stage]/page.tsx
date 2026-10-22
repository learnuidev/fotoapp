import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, CircleSlash } from 'lucide-react';
import { isStage, STAGES } from '@/lib/types';
import { readStage } from '@/server/plan';
import { DeployControls } from '@/components/deploy-controls';
import { StatusPill, stackLabel, stackTone } from '@/components/status';
import { currentWebEnv } from '@/server/env-file';

export const dynamic = 'force-dynamic';

/**
 * One environment in full: what it is made of, what it hands the app, and what a deploy
 * would run into.
 *
 * The order is the order of the questions a deploy asks — is it up, what did it produce,
 * what is missing, what are the values — with the buttons at the top because they are
 * what the page is for.
 */
export default async function StagePage({ params }: { params: { stage: string } }) {
  if (!isStage(params.stage)) notFound();
  const detail = await readStage(params.stage);
  const envFile = currentWebEnv();
  const pointedHere = Boolean(
    envFile && detail.apiUrl && envFile.includes(detail.apiUrl),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/backends"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> all backends
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl tracking-tight">{detail.stage}</h1>
            <StatusPill
              status={detail.healthy ? 'ok' : detail.deployed ? 'warn' : 'idle'}
              label={detail.healthy ? 'deployed' : detail.deployed ? 'partly deployed' : 'not deployed'}
            />
          </div>
          <DeployControls stage={detail.stage} actions={['synth', 'diff', 'deploy', 'destroy']} />
        </div>
      </div>

      {detail.problems.length > 0 && (
        <div className="rounded-3xl border border-warn/30 bg-warn/5 p-5">
          <h2 className="text-sm font-medium text-warn">Before the app can use this</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {detail.problems.map((problem) => (
              <li key={problem}>· {problem}</li>
            ))}
          </ul>
        </div>
      )}

      {/* --- the four stacks ------------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Stacks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {detail.stacks.map((stack) => (
            <div key={stack.id} className="rounded-3xl border border-border bg-card/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{stack.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stack.description}</p>
                </div>
                <StatusPill status={stackTone(stack)} label={stackLabel(stack.status)} />
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">{stack.stackName}</p>
              {stack.updatedAt && (
                <p className="font-mono text-[11px] text-muted-foreground/60">
                  {new Date(stack.updatedAt).toLocaleString()}
                </p>
              )}
              {Object.keys(stack.outputs).length > 0 && (
                <dl className="mt-3 flex flex-col gap-1 border-t border-border pt-3 font-mono text-[11px]">
                  {Object.entries(stack.outputs)
                    .filter(([key]) => !key.startsWith('aws:') && !key.startsWith('Exports'))
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="truncate text-right text-foreground/80" title={value}>
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --- what it hands the app ------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
            What the app is handed
          </h2>
          <StatusPill
            status={pointedHere ? 'ok' : 'idle'}
            label={pointedHere ? 'apps/web is pointed here' : 'apps/web is pointed elsewhere'}
          />
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">variable</th>
                <th className="px-5 py-2.5 font-medium">value</th>
                <th className="px-5 py-2.5 font-medium">where it came from</th>
              </tr>
            </thead>
            <tbody>
              {detail.env.map((entry) => (
                <tr key={entry.name} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-[11px]">{entry.name}</td>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-foreground/80">
                    {entry.value ?? <span className="text-bad">missing</span>}
                  </td>
                  <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{entry.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link href="/frontend" className="text-accent hover:underline">
            Start the app against {detail.stage}
          </Link>{' '}
          to write these into <code className="rounded bg-card px-1">apps/web/.env.local</code> and
          run it.
        </p>
      </section>

      {/* --- the checklist --------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">What a deploy needs</h2>
        <div className="flex flex-col gap-2">
          {detail.checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3"
            >
              {item.done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-ok" />
              ) : (
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              )}
              <div>
                <p className="text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Other stages:{' '}
        {STAGES.filter((stage) => stage !== detail.stage).map((stage, index) => (
          <span key={stage}>
            {index > 0 && ' · '}
            <Link href={`/backends/${stage}`} className="text-accent hover:underline">
              {stage}
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}
