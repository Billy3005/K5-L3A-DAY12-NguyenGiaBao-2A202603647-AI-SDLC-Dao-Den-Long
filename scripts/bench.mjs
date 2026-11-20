// bench_cmd (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json [--headless]
// Serves dist/web with dist/server.js (in-process), opens a real 1280×720 browser window with Playwright,
// loads the bench scene (?bench=1) and writes bench.json. Requires `npm run build` first.
// Browser: installed Google Chrome, else Microsoft Edge, else Playwright's Chromium (`npx playwright install chromium`).
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { cpus, homedir, release, type, arch, totalmem } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const seed = Number(opt('seed', 42)), duration = Number(opt('duration', 30)), out = opt('out', 'bench.json');
const headless = argv.includes('--headless');
if (!Number.isInteger(seed) || !(duration > 0)) { console.error('usage: bench --seed <int> --duration <s> --out <file> [--headless]'); process.exit(1); }
if (!existsSync('dist/server.js') || !existsSync('dist/web/index.html')) { console.error('error: run `npm run build` first'); process.exit(1); }

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall back to a shared install */ }
  const dir = process.env.PW_TOOLS_DIR ?? join(homedir(), 'pw-tools');
  return createRequire(join(dir, 'package.json'))('playwright');
}

const PORT = Number(opt('port', 4317));
const server = await import(pathToFileURL(join(process.cwd(), 'dist', 'server.js')).href);
server.main(['--port', String(PORT), '--host', '127.0.0.1']);

const { chromium } = await loadPlaywright();
const FLAGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1280,800', '--window-position=40,40'];
let browser, channel = 'chromium';
for (const ch of ['chrome', 'msedge', undefined]) {
  try { browser = await chromium.launch({ channel: ch, headless, args: FLAGS }); channel = ch ?? 'playwright-chromium'; break; } catch { /* try next */ }
}
if (!browser) { console.error('error: no browser found (install Chrome, or run `npx playwright install chromium`)'); process.exit(1); }

let loadMs = null;
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.exposeFunction('__benchFirstFrame', () => { loadMs ??= Math.round(performance.now()); }); // ms since this process started
const done = new Promise((res) => page.exposeFunction('__benchDone', res));
const timeout = setTimeout(() => { console.error('error: bench did not finish'); process.exit(1); }, (duration + 120) * 1000);
await page.goto(`http://127.0.0.1:${PORT}/?bench=1&seed=${seed}&duration=${duration}`);
const r = await done;
clearTimeout(timeout);

const uncapped = r.avg_fps > 65; // Codex D1: flags alone do not prove vsync is off; >65 fps means not capped at 60 Hz
const result = {
  contract_version: '1.3',
  avg_fps: r.avg_fps,
  p1_low_fps: r.p1_low_fps,
  frame_ms_p95: r.frame_ms_p95,
  frames: r.frames,
  load_ms: loadMs,
  peak_mem_mb: null,
  vsync_off: uncapped,
  renderer: `Three.js r${r.three} WebGL2 in ${channel} ${browser.version()}${headless ? ' (headless)' : ''}; GPU: ${r.gl}`,
  os: `${type()} ${release()} ${arch()}; ${cpus()[0]?.model.trim()} x${cpus().length}; ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
  mem_note: 'Web build: Chromium runs the game in separate renderer/GPU processes whose RSS Playwright does not expose, so peak_mem_mb is null. js_heap_peak_mb is the page JS heap (performance.memory).',
  js_heap_peak_mb: r.js_heap_peak_mb,
  vsync_note: `Started with --disable-gpu-vsync --disable-frame-rate-limit; vsync_off is true only if the measured avg_fps exceeded 65 (not capped at 60 Hz).`,
  scene: { seed, duration_s: duration, warmup_s: 3, shades: r.shades, motes: r.motes, viewport: '1280x720' },
};
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
await browser.close();
process.exit(0);
