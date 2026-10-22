/**
 * What the console knows, and what it hands to a screen.
 *
 * The unit of this app is **a stage**: the whole console is about one environment at
 * a time, so almost every type below is either a stage or something a stage has.
 */

/** The environments this repository can be deployed to. */
export const STAGES = ['dev', 'staging', 'prod'] as const;
export type Stage = (typeof STAGES)[number];

export function isStage(value: string | undefined | null): value is Stage {
  return !!value && (STAGES as readonly string[]).includes(value);
}

/** The four stacks a stage is made of, in the order a first deploy creates them. */
export const STACKS = [
  { id: 'data', label: 'Data', description: 'seven DynamoDB tables, one per collection' },
  { id: 'media', label: 'Media', description: 'the photo bucket and the CDN in front of it' },
  { id: 'auth', label: 'Auth', description: 'the host user pool, its client and the parameters that advertise it' },
  { id: 'api', label: 'API', description: 'the HTTP API, one Lambda per domain, and the guest-session secret' },
] as const;

export type StackId = (typeof STACKS)[number]['id'];

/** One CloudFormation stack, as the console reads it. */
export interface StackState {
  id: StackId;
  label: string;
  description: string;
  stackName: string;
  /** CloudFormation's own status: `CREATE_COMPLETE`, `UPDATE_ROLLBACK_COMPLETE`, or `NOT_DEPLOYED`. */
  status: string;
  /** True when the status says the stack is usable right now. */
  healthy: boolean;
  /** Milliseconds since the stack's last update, or null when it has never been deployed. */
  updatedAt: number | null;
  outputs: Record<string, string>;
}

/** What the app needs, and where each value comes from. */
export interface EnvValue {
  name: string;
  value: string | null;
  /** Where the console got it: a stack output, or a parameter in SSM. */
  source: string;
}

/** The five numbers a stage is described by, for its card in the list. */
export interface StageSummary {
  stage: Stage;
  stacks: StackState[];
  deployed: boolean;
  healthy: boolean;
  apiUrl: string | null;
  appUrl: string;
}

/** One stage, in full. */
export interface StageDetail extends StageSummary {
  env: EnvValue[];
  /** The problems a deploy would run into, in the order they would happen. */
  problems: string[];
  /** What a first deploy of this stage still has to create. */
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  label: string;
  detail: string;
  done: boolean;
}

/** A cdk run: synth, diff, deploy or destroy, and the transcript it produced. */
export type RunAction = 'synth' | 'diff' | 'deploy' | 'destroy';

export interface Run {
  id: string;
  action: RunAction;
  stage: Stage;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: number;
  endedAt: number | null;
  /** Every line so far, in order. */
  lines: string[];
  /** The command as it was typed into a shell, for the header of a transcript. */
  command: string;
}

/** The app's dev server, as the console started it. */
export interface FrontendState {
  status: 'stopped' | 'starting' | 'running' | 'failed';
  stage: Stage | null;
  url: string;
  startedAt: number | null;
  /** The last lines it printed, for the panel under the button. */
  log: string[];
}

/** Who the console is acting as, in AWS. */
export interface AwsIdentity {
  account: string | null;
  arn: string | null;
  userId: string | null;
  region: string;
  profile: string | null;
  error: string | null;
}
