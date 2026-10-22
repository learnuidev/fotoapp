'use client';

import { useEffect, useState } from 'react';
import type { AwsIdentity } from '@/lib/types';

/**
 * Who the console is acting as, in the corner.
 *
 * It is the first thing to check when a deploy says a stack does not exist, so it is
 * always on screen rather than on the AWS page alone.
 */
export function IdentityBadge() {
  const [identity, setIdentity] = useState<AwsIdentity | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/aws', { cache: 'no-store' })
      .then((response) => response.json() as Promise<AwsIdentity>)
      .then((value) => live && setIdentity(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!identity) {
    return <span className="font-mono text-xs text-muted-foreground">…</span>;
  }

  if (identity.error) {
    return (
      <span className="rounded-full border border-bad/40 bg-bad/10 px-2.5 py-1 text-[11px] text-bad">
        no AWS credential
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <span className="rounded-full border border-border px-2 py-0.5">
        {identity.profile ?? 'default'}
      </span>
      <span>{identity.account}</span>
      <span className="text-muted-foreground/60">{identity.region}</span>
    </span>
  );
}
