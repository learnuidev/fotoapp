/**
 * A child process's line without its terminal control codes.
 *
 * `next dev` and `cdk` both paint when they think nobody is watching: a transcript
 * carrying `[?25h` and colour escapes is one nobody can read, and one that is harder
 * to copy out of when something fails.
 */
export function stripAnsi(line: string): string {
  // eslint-disable-next-line no-control-regex
  return line.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\u001b\][^\u0007]*\u0007/g, '');
}
