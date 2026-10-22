import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { STAGES } from '@/lib/types';
import { readStageSummaries } from '@/server/plan';
import { DeployControls } from '@/components/deploy-controls';
import { StatusPill, stackLabel, stackTone } from '@/components/status';

export const dynamic = 'force-dynamic';

/**
 * Every environment, and what each one is.
 *
 * A "backend" here is four stacks — data, media, auth, api — and the list shows them
 * as four dots rather than one status, because "the API is up but auth is not" is the
 * state that explains a sign-in that cannot work, and one green light would hide it.
 */
export default async function BackendsPage() {
  const summaries = await readStageSummaries([...STAGES]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl tracking-tight">Backends</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Each environment is four CloudFormation stacks: the tables, the photo bucket and
          its CDN, the host user pool, and the API itself. Deploy runs{' '}
          <code className="rounded bg-card px-1">cdk deploy --all --context stage=&lt;stage&gt;</code>{' '}
          in <code className="rounded bg-card px-1">infra/</code> with the AWS credential this
          console was started with.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {summaries.map((summary) => (
          <div
            key={summary.stage}
            className="rounded-3xl border border-border bg-card/60 p-5 transition-colors hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/backends/${summary.stage}`}
                    className="font-mono text-lg tracking-tight hover:underline"
                  >
                    {summary.stage}
                  </Link>
                  <StatusPill
                    status={summary.healthy ? 'ok' : summary.deployed ? 'warn' : 'idle'}
                    label={
                      summary.healthy
                        ? 'deployed'
                        : summary.deployed
                          ? 'partly deployed'
                          : 'not deployed'
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  {summary.stacks.map((stack) => (
                    <span key={stack.id} className="flex items-center gap-1.5">
                      <span
                        className={{
                          ok: 'size-1.5 rounded-full bg-ok',
                          warn: 'size-1.5 rounded-full bg-warn',
                          bad: 'size-1.5 rounded-full bg-bad',
                          idle: 'size-1.5 rounded-full bg-muted-foreground/50',
                        }[stackTone(stack)]}
                      />
                      {stack.label}
                      <span className="text-muted-foreground/60">{stackLabel(stack.status)}</span>
                    </span>
                  ))}
                </div>

                <p className="font-mono text-xs text-muted-foreground">
                  {summary.apiUrl ?? 'no API URL yet'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <DeployControls stage={summary.stage} size="small" actions={['deploy']} />
                <Link
                  href={`/backends/${summary.stage}`}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  everything about {summary.stage} <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
