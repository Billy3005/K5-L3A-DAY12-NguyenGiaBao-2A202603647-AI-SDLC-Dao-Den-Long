// Visual evidence: serve the built game (vite preview), drive it with Playwright, save screenshots.
// Usage: npm run build && npm run shots -- <phase>
// Playwright is resolved from the project, else from $PW_TOOLS_DIR (default ~/pw-tools: shared local install).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const phase = process.argv[2] ?? '3';
const out = join('docs', 'proof', `phase-${phase}`, 'screens');
mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* not a project dependency */ }
  const dir = process.env.PW_TOOLS_DIR ?? join(homedir(), 'pw-tools');
  return createRequire(join(dir, 'package.json'))('playwright');
}

const PORT = 4199;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite preview did not start')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const shot = async (name, caption) => { await page.screenshot({ path: join(out, `${name}.png`) }); console.log(`${name}.png  ${caption}`); };
const wait = (ms) => page.waitForTimeout(ms);
const load = (n, sc, yaw = 0) => page.evaluate(([n, sc, yaw]) => window.ddl.load(n, sc, yaw), [n, sc, yaw]);

try {
  await page.goto(`http://localhost:${PORT}/`);
  await wait(1500);
  await shot('01-menu', 'Menu chính');
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await wait(300);
  await shot('02-settings', 'Cài đặt: âm lượng, độ nhạy chuột, "Bảng màu dễ phân biệt" (Ticket-03 §6)');
  await page.getByRole('button', { name: 'Quay lại' }).click();

  // Ticket-03 lantern states in one row in front of the camera; shade draining the weak lantern; 25 s left
  const Q = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], drifters: [], charms: [] };
  const lanternRow = {
    ...Q, time_left_s: 25,
    player: { pos: [0, 0, 13], carried: 7, successful_lights: 2 },
    lanterns: [
      { id: 'L1', pos: [-6, 0, 22], lit: true, fuel: 100 },
      { id: 'L2', pos: [-2, 0, 22], lit: true, fuel: 55 },
      { id: 'L3', pos: [2, 0, 22], lit: true, fuel: 22 },
      { id: 'L4', pos: [6, 0, 22], ever_lit: true },
    ],
    shades: [{ id: 'S1', pos: [2, 1, 23.5], state: 'drain', target_lantern_id: 'L3' }, { id: 'S2', pos: [-9, 1, 30] }],
  };
  await page.evaluate(() => window.ddl.setColorblind(false));
  await load(1, lanternRow);
  await wait(700);
  await shot('03-fuel-states', 'Thanh dầu 100/55; đèn L3 dầu 22 (<30) đang bị Bóng Mực hút; L4 tắt (xẹp + rách); HUD 7/14, cần 3, đồng hồ đỏ ≤30 s');
  await wait(500);
  await shot('04-low-fuel-blink', 'Nửa chu kỳ sau (500 ms): đèn L3 và thanh dầu tắt nhấp nháy 1 Hz');
  await page.evaluate(() => window.ddl.setColorblind(true));
  await load(1, lanternRow);
  await wait(700);
  await shot('05-colorblind', 'Bảng màu dễ phân biệt: viền/mắt Bóng Mực #00B3FF, cảnh báo trắng kèm ⚠');
  await page.evaluate(() => window.ddl.setColorblind(false));

  // Dawn on night 3 with 5/7 lit -> Bình Minh screen
  await load(3, { ...Q, shades: [], time_left_s: 1, player: { pos: [0, 0, -30] },
    lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true, fuel: 60 })) });
  await wait(2000);
  await shot('06-binh-minh', 'Sống tới bình minh Đêm 3 với 5/7 đèn sáng → màn Bình Minh (dawn_survived)');

  // Night 2 and 3 maps in play
  await load(2, { ...Q, player: { pos: [20, 0, 10] } }, 60);
  await wait(800);
  await shot('07-night2-map', 'Đêm 2 Đảo Cau: hai đảo, cầu tre, bục nhảy, Bùa Gió');
  await load(3, { ...Q, player: { pos: [0, 0, -30] } }, 0);
  await wait(800);
  await shot('08-night3-map', 'Đêm 3 Đảo Chuông: tầng, dốc, tháp chuông');
} finally {
  await browser.close();
  server.kill();
}
