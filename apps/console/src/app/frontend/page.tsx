import { STAGES } from '@/lib/types';
import { readStageSummaries } from '@/server/plan';
import { FrontendControls } from '@/components/frontend-controls';
import { StatusPill } from '@/components/status';

export const dynamic = 'force-dynamic';

/**
 * The app, and the environment it runs against.
 *
 * This is the page that makes "start the frontend for any env" one press: pick a stage,
 * press start, and the console writes the app's `.env.local` from that stage's stacks
 * and runs `next dev` on 3100 with the same values.
 *
 * It is honest about the shape of this deployment: the app runs on this machine and the
 * API does not, so "any env" means any *deployed* env.
 */
export default async function FrontendPage() {
  const summaries = await readStageSummaries([...STAGES]);
  const ready = summaries.filter((summary) => summary.healthy);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl tracking-tight">Frontend</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          <code className="rounded bg-card px-1">apps/web</code> runs here, on port 3100, and the
          API it calls is whichever stage you point it at. Starting it writes{' '}
          <code className="rounded bg-card px-1">apps/web/.env.local</code> from that stage&apos;s
          stacks and parameters, so the file on disk always says what the running app is talking
          to.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card/60 p-5">
        <FrontendControls stages={STAGES.filter((stage) => ready.some((s) => s.stage === stage))} />
        {ready.length === 0 && (
          <p className="text-sm text-warn">
            No stage is deployed yet. Deploy one on the Backends page and it appears here.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Environments</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {summaries.map((summary) => (
            <div key={summary.stage} className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{summary.stage}</span>
                <StatusPill
                  status={summary.healthy ? 'ok' : summary.deployed ? 'warn' : 'idle'}
                  label={summary.healthy ? 'ready' : summary.deployed ? 'partly' : 'none'}
                />
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                {summary.apiUrl ?? 'no API yet'}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
                app at {summary.appUrl}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
          Running it by hand
        </h2>
        <p className="text-sm text-muted-foreground">
          The console is a convenience over two commands that work on their own.
        </p>
        <pre className="terminal rounded-2xl border p-4 font-mono text-[11px]">{`# the five values a stage hands the app
aws cloudformation describe-stacks --stack-name FotoApiStack-dev \\
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
aws ssm get-parameter --name /foto/dev/cognito/user-pool-id --query Parameter.Value --output text
aws ssm get-parameter --name /foto/dev/cognito/client-id --query Parameter.Value --output text

# then, with apps/web/.env.local filled in
npm run dev`}</pre>
      </section>
    </div>
  );
}
