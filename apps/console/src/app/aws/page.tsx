import { readIdentity } from '@/server/aws';
import { StatusPill } from '@/components/status';

export const dynamic = 'force-dynamic';

/**
 * Who the console acts as.
 *
 * A deploy only ever runs with the credential the console inherited when it started, so
 * this page answers the two questions a failed deploy raises: which account am I in,
 * and is this credential even valid. A console that could switch accounts mid-session
 * would be a console that could deploy `prod` because the wrong row was clicked.
 */
export default async function AwsPage() {
  const identity = await readIdentity();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl tracking-tight">AWS</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The console reads the account with the standard AWS credential chain — the profile in{' '}
          <code className="rounded bg-card px-1">AWS_PROFILE</code> when the console was started,
          otherwise the default. Deploys inherit it.
        </p>
      </div>

      <section className="rounded-3xl border border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            status={identity.error ? 'bad' : 'ok'}
            label={identity.error ? 'no usable credential' : 'authenticated'}
          />
          <span className="font-mono text-xs text-muted-foreground">
            profile {identity.profile ?? 'default'} · region {identity.region}
          </span>
        </div>

        {identity.error ? (
          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
            <p className="text-bad">{identity.error}</p>
            <p>Start the console with a profile that works:</p>
            <pre className="rounded-2xl border border-border bg-black/40 p-4 font-mono text-[11px]">{`AWS_PROFILE=<your-profile> npm run console`}</pre>
          </div>
        ) : (
          <dl className="mt-4 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
            <Row label="account" value={identity.account ?? '—'} />
            <Row label="region" value={identity.region} />
            <Row label="arn" value={identity.arn ?? '—'} />
            <Row label="user id" value={identity.userId ?? '—'} />
          </dl>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">What a deploy does</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The console spawns{' '}
          <code className="rounded bg-card px-1">
            npx cdk deploy --all --context stage=&lt;stage&gt; --require-approval never
          </code>{' '}
          in <code className="rounded bg-card px-1">infra/</code> and shows its transcript. It
          writes nothing to AWS itself: there is one implementation of the deployment, and this is
          a window onto it.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-black/25 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground/85">{value}</dd>
    </div>
  );
}
