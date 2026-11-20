// Claude Code Stop hook: block the agent from finishing while tests are red.
// A second consecutive block (stop_hook_active) is let through with a warning to avoid an infinite loop.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload = {};
try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no payload */ }

const r = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot'], { encoding: 'utf8' });
if (r.status === 0) process.exit(0);

const tail = `${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-25).join('\n');
if (payload.stop_hook_active) {
  process.stderr.write(`stop-gate: tests STILL red after one retry; allowing stop. Report this honestly.\n${tail}\n`);
  process.exit(0);
}
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `Tests are red (npm test). Fix them before finishing, or explain honestly why not.\n${tail}`,
}));
