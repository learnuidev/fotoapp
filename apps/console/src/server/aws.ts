/**
 * Talking to AWS, read-only.
 *
 * Everything here is a *read*: which stacks exist, what status they are in, and what
 * they were deployed with. The one thing that writes to AWS is a `cdk deploy`, and it
 * runs as a child process with a transcript the console can show — see `runs.ts`.
 *
 * That split is deliberate. A console that made AWS calls itself would be a second
 * implementation of the deployment, and the two would drift; a console that can only
 * *start* the deployment and then report on it is a window onto the one implementation.
 */
import {
  CloudFormationClient,
  DescribeStacksCommand,
  type Output,
  type Stack,
} from '@aws-sdk/client-cloudformation';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import type { AwsIdentity, StackId, StackState, Stage } from '@/lib/types';
import { STACKS } from '@/lib/types';
import { awsProfile, awsRegion } from './repo';

const clients = {
  get cfn() {
    return new CloudFormationClient({ region: awsRegion });
  },
  get ssm() {
    return new SSMClient({ region: awsRegion });
  },
  get sts() {
    return new STSClient({ region: awsRegion });
  },
};

/** `Foto<Id>Stack-<stage>` — the naming `infra/src/app.ts` uses for every stack. */
export function stackName(id: StackId, stage: Stage): string {
  return `Foto${id[0]!.toUpperCase()}${id.slice(1)}Stack-${stage}`;
}

/** A stage's four stack names, in deploy order. */
export function stackNames(stage: Stage): { id: StackId; name: string }[] {
  return STACKS.map((stack) => ({ id: stack.id, name: stackName(stack.id, stage) }));
}

/** Statuses that mean "this stack exists and works". */
const HEALTHY = new Set(['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE']);

function toOutputs(outputs: Output[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const output of outputs ?? []) {
    if (output.OutputKey && output.OutputValue) result[output.OutputKey] = output.OutputValue;
  }
  return result;
}

function toState(id: StackId, stage: Stage, stack: Stack | undefined): StackState {
  const meta = STACKS.find((entry) => entry.id === id)!;
  const status = stack?.StackStatus ?? 'NOT_DEPLOYED';
  return {
    id,
    label: meta.label,
    description: meta.description,
    stackName: stackName(id, stage),
    status,
    healthy: HEALTHY.has(status),
    updatedAt: stack?.LastUpdatedTime?.getTime() ?? stack?.CreationTime?.getTime() ?? null,
    outputs: toOutputs(stack?.Outputs),
  };
}

/** Every stack of one stage, in deploy order. Missing stacks come back as `NOT_DEPLOYED`. */
export async function readStacks(stage: Stage): Promise<StackState[]> {
  const names = stackNames(stage);
  const found = new Map<string, Stack>();

  // DescribeStacks refuses a batch containing a stack that does not exist, so each
  // name is asked for on its own. A stage that has never been deployed answers with
  // three ValidationErrors and that is the normal case, not an error worth throwing.
  await Promise.all(
    names.map(async ({ name }) => {
      try {
        const result = await clients.cfn.send(new DescribeStacksCommand({ StackName: name }));
        const stack = result.Stacks?.[0];
        if (stack) found.set(name, stack);
      } catch {
        // Not deployed (or not visible to this identity). Both are "not here yet".
      }
    }),
  );

  return names.map(({ id, name }) => toState(id, stage, found.get(name)));
}

/** One value from SSM Parameter Store, or null. */
export async function readParameter(name: string): Promise<string | null> {
  try {
    const result = await clients.ssm.send(new GetParametersCommand({ Names: [name] }));
    return result.Parameters?.[0]?.Value ?? null;
  } catch {
    return null;
  }
}

/** Several parameters in one call, in the order they were asked for. */
export async function readParameters(names: string[]): Promise<(string | null)[]> {
  if (names.length === 0) return [];
  try {
    const result = await clients.ssm.send(new GetParametersCommand({ Names: names }));
    return names.map((name) => result.Parameters?.find((entry) => entry.Name === name)?.Value ?? null);
  } catch {
    return names.map(() => null);
  }
}

/** Who the console is acting as. A missing or expired credential is reported, not thrown. */
export async function readIdentity(): Promise<AwsIdentity> {
  try {
    const result = await clients.sts.send(new GetCallerIdentityCommand({}));
    return {
      account: result.Account ?? null,
      arn: result.Arn ?? null,
      userId: result.UserId ?? null,
      region: awsRegion,
      profile: awsProfile,
      error: null,
    };
  } catch (error) {
    return {
      account: null,
      arn: null,
      userId: null,
      region: awsRegion,
      profile: awsProfile,
      error: error instanceof Error ? error.message : 'Unknown AWS error',
    };
  }
}
