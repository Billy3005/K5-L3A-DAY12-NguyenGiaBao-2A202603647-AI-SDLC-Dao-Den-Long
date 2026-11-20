import { readFileSync, writeFileSync } from 'node:fs';
import { InputsSchema, ScenarioSchema } from './io/schemas';
import { runHeadless } from './io/run';
import { ScenarioError } from './sim/world';

class CliError extends Error { constructor(msg: string, public code: number) { super(msg); } }

function parseArgs(argv: string[]): Record<string, string> {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new CliError(`unexpected argument: ${k}`, 1);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new CliError(`missing value for ${k}`, 1);
    a[k.slice(2)] = v;
    i++;
  }
  return a;
}

function int(a: Record<string, string>, k: string, required: boolean, min: number): number | undefined {
  if (a[k] === undefined) {
    if (required) throw new CliError(`--${k} is required`, 1);
    return undefined;
  }
  if (!/^-?\d+$/.test(a[k]) || Number(a[k]) < min) throw new CliError(`--${k} must be an integer >= ${min}`, 1);
  return Number(a[k]);
}

function loadJson<T>(path: string, schema: { safeParse(x: unknown): { success: boolean; data?: T; error?: unknown } }, label: string): T {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
    throw new CliError(`${label}: cannot read/parse ${path}: ${(e as Error).message}`, 2);
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new CliError(`${label}: invalid format: ${String(r.error)}`, 2);
  return r.data as T;
}

export function main(argv: string[]): number {
  try {
    const a = parseArgs(argv);
    const seed = int(a, 'seed', true, Number.MIN_SAFE_INTEGER)!;
    const night = int(a, 'night', true, 1)!;
    if (night !== 1) throw new CliError(`--night ${night} not supported (only 1)`, 1);
    const ticks = int(a, 'ticks', true, 0)!;
    const snapshotEvery = int(a, 'snapshot-every', false, 1);
    if (!a.out) throw new CliError('--out is required', 1);
    const scenario = a.scenario ? loadJson(a.scenario, ScenarioSchema, 'scenario') : undefined;
    const inputs = a.inputs ? loadJson(a.inputs, InputsSchema, 'inputs') : undefined;
    let lines: string[];
    try {
      lines = runHeadless({ seed, ticks, snapshotEvery, scenario, inputs });
    } catch (e) {
      if (e instanceof ScenarioError) throw new CliError(`scenario: ${e.message}`, 2);
      throw e;
    }
    writeFileSync(a.out, lines.join('\n') + '\n');
    return 0;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return e instanceof CliError ? e.code : 1;
  }
}

// Run when executed directly (bundled dist/headless.js or tsx).
if (process.argv[1] && /headless\.(js|ts)$/.test(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
