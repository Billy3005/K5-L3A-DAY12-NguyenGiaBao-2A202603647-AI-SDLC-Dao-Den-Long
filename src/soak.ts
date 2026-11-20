// soak_cmd: node --expose-gc --no-opt dist/soak.js --seed 7 --nights 10 --out soak.json  (Ticket-04 §2)
import { writeFileSync } from 'node:fs';
import { runSoak } from './io/soak';

const mb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = () => (globalThis as { gc?: () => void }).gc?.();

export function main(argv: string[]): number {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) { process.stderr.write(`error: bad argument ${argv[i]}\n`); return 1; }
    a[argv[i].slice(2)] = argv[i + 1];
  }
  const seed = Number(a.seed ?? 7), nights = Number(a.nights ?? 10);
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !a.out) {
    process.stderr.write('usage: soak --seed <int> --nights <int>=1> --out <file>\n'); return 1;
  }
  const t0 = performance.now();
  let memStart = 0;
  const r = runSoak(seed, nights, () => { gc(); memStart = mb(); });
  gc();
  const memEnd = mb();
  const out = {
    nights: r.nights, crashes: r.crashes, results: r.results,
    mem_start_mb: memStart, mem_end_mb: memEnd,
    duration_s: Math.round((performance.now() - t0) / 100) / 10,
  };
  writeFileSync(a.out, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify(out) + '\n');
  return 0;
}

if (process.argv[1] && /soak\.(js|ts)$/.test(process.argv[1])) process.exitCode = main(process.argv.slice(2));
