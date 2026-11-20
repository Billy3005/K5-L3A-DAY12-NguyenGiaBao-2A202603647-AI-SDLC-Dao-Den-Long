// Phase verification: build, run every tests/scenarios/*.json through the REAL CLI (dist/headless.js)
// twice, check determinism + expectations, write evidence to docs/proof/phase-N/.
// Usage: npm run verify -- <phase> [--no-build]
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const phase = process.argv[2] ?? '1';
const outDir = join('docs', 'proof', `phase-${phase}`);
if (!process.argv.includes('--no-build')) execSync('npm run build', { stdio: 'inherit' });

const isSubset = (exp, act) => {
  if (exp === null || typeof exp !== 'object') return exp === act;
  if (Array.isArray(exp)) return Array.isArray(act) && exp.length === act.length && exp.every((e, i) => isSubset(e, act[i]));
  return act && typeof act === 'object' && Object.entries(exp).every(([k, v]) => isSubset(v, act[k]));
};

rmSync(outDir, { recursive: true, force: true });
const rows = [];
let failed = 0;
for (const file of readdirSync('tests/scenarios').filter((f) => f.endsWith('.json')).sort()) {
  const name = file.replace(/\.json$/, '');
  const spec = JSON.parse(readFileSync(join('tests/scenarios', file), 'utf8'));
  const dir = join(outDir, name);
  mkdirSync(dir, { recursive: true });
  const args = ['dist/headless.js', '--seed', String(spec.seed), '--night', String(spec.night ?? 1), '--ticks', String(spec.ticks)];
  if (spec.snapshot_every) args.push('--snapshot-every', String(spec.snapshot_every));
  if (spec.scenario) { writeFileSync(join(dir, 'scenario.json'), JSON.stringify(spec.scenario, null, 2)); args.push('--scenario', join(dir, 'scenario.json')); }
  if (spec.inputs) { writeFileSync(join(dir, 'inputs.json'), JSON.stringify(spec.inputs, null, 2)); args.push('--inputs', join(dir, 'inputs.json')); }

  const run = (out) => {
    const t0 = process.hrtime.bigint();
    const r = spawnSync(process.execPath, [...args, '--out', out], { encoding: 'utf8' });
    return { ...r, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  };
  const out1 = join(dir, 'out.jsonl'), out2 = join(dir, 'out.run2.jsonl');
  const r1 = run(out1), r2 = run(out2);
  const problems = [];
  if (r1.status !== spec.expect_exit) problems.push(`exit ${r1.status} != ${spec.expect_exit} (${r1.stderr.trim()})`);
  if (spec.expect_exit === 0) {
    const a = readFileSync(out1, 'utf8'), b = readFileSync(out2, 'utf8');
    if (a !== b) problems.push('NOT deterministic: run1 != run2');
    const lines = a.trim().split('\n').map((l) => JSON.parse(l));
    const evs = lines.filter((l) => l.type === 'event');
    let i = 0;
    for (const e of spec.expect_events ?? []) {
      while (i < evs.length && !isSubset(e, evs[i])) i++;
      if (i === evs.length) { problems.push(`missing event (in order): ${JSON.stringify(e)}`); break; }
      i++;
    }
    for (const name of spec.expect_no_events ?? []) {
      const bad = evs.find((e) => e.name === name);
      if (bad) problems.push(`unexpected event: ${JSON.stringify(bad)}`);
    }
    const end = lines.at(-1);
    if (end.type !== 'end') problems.push('last line is not end');
    if (spec.expect_end && !isSubset(spec.expect_end, end)) problems.push(`end ${JSON.stringify(end)} !~ ${JSON.stringify(spec.expect_end)}`);
    rmSync(out2);
  } else writeFileSync(join(dir, 'stderr.txt'), r1.stderr);
  const ok = problems.length === 0;
  if (!ok) failed++;
  rows.push(`| ${name} | ${spec.requirement} | ${r1.status} | ${r1.ms.toFixed(0)} ms | ${ok ? 'ĐẠT' : 'CHƯA ĐẠT: ' + problems.join('; ')} |`);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' -> ' + problems.join('; ')}`);
}

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const dirty = execSync('git status --porcelain -- . ":!docs/proof"').toString().trim() ? ' (working tree có thay đổi chưa commit)' : '';
writeFileSync(join(outDir, 'summary.md'), `# Bằng chứng headless: Phase ${phase}

Sinh tự động bởi \`npm run verify -- ${phase}\` (không sửa tay). Mỗi scenario chạy qua CLI thật \`node dist/headless.js\` **hai lần**; hai output phải giống hệt nhau (tất định), sau đó đối chiếu sự kiện kỳ vọng (theo thứ tự) và dòng \`end\`.

- Commit: \`${commit}\`${dirty}
- Máy: ${os.type()} ${os.release()} · ${os.cpus()[0]?.model ?? '?'} · Node ${process.version}
- Thời điểm: ${new Date().toISOString()}

| Scenario | Yêu cầu | Exit | Thời gian chạy | Kết quả |
|---|---|---|---|---|
${rows.join('\n')}

Đầu vào và output của mỗi scenario nằm trong thư mục con cùng tên (\`scenario.json\`, \`inputs.json\`, \`out.jsonl\`). Định nghĩa kỳ vọng: \`tests/scenarios/*.json\`.
`);
console.log(`\n${rows.length - failed}/${rows.length} scenarios passed -> ${join(outDir, 'summary.md')}`);
process.exit(failed ? 1 : 0);
