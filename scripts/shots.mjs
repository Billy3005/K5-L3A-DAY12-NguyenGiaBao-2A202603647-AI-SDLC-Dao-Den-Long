// Visual evidence: serve the built game (vite preview), drive it with Playwright, save screenshots.
// Usage: npm run build && npm run shots -- <phase>
// Playwright is resolved from the project, else from $PW_TOOLS_DIR (default ~/pw-tools: shared local install).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
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

// Served by dist/server.js (run_cmd) so the leaderboard API is real; its file is a throwaway copy under the proof dir.
const PORT = 4199;
const board = join('docs', 'proof', `phase-${phase}`, 'leaderboard.json');
if (phase === '4' && existsSync(board)) rmSync(board);
const server = spawn(process.execPath, ['dist/server.js', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'pipe', env: { ...process.env, LEADERBOARD_FILE: board } });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server did not start')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const shot = async (name, caption) => { await page.screenshot({ path: join(out, `${name}.png`) }); console.log(`${name}.png  ${caption}`); };
const wait = (ms) => page.waitForTimeout(ms);
const load = (n, sc, yaw = 0) => page.evaluate(([n, sc, yaw]) => window.ddl.load(n, sc, yaw), [n, sc, yaw]);

const Q = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], drifters: [], charms: [] };
try {
  await page.goto(`http://localhost:${PORT}/`);
  await wait(1500);
  if (phase === '4') { await phase4(); process.exit(0); }
  await shot('01-menu', 'Menu chính');
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await wait(300);
  await shot('02-settings', 'Cài đặt: âm lượng, độ nhạy chuột, "Bảng màu dễ phân biệt" (Ticket-03 §6)');
  await page.getByRole('button', { name: 'Quay lại' }).click();

  // Ticket-03 lantern states in one row in front of the camera; shade draining the weak lantern; 25 s left
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

// Ticket-04: accessibility, captions, leaderboard (real server API + on-disk file)
async function phase4() {
  const click = (name) => page.getByRole('button', { name, exact: true }).click();
  await page.evaluate(() => window.ddl.set({ bigText: false, reducedMotion: false, colorblind: false }));
  await click('Cài đặt'); await wait(300);
  await shot('01-settings-a11y', 'Cài đặt: thêm "Giảm chuyển động", "Chữ lớn (×1.25)", nút "Đổi phím"');
  await click('Đổi phím'); await wait(200);
  await page.locator('button[data-act="jump"]').click(); await page.keyboard.press('KeyF'); await wait(200);
  await shot('02-keys-duplicate', 'Gán Nhảy = F (đang là Tỏa sáng) → bị từ chối và báo trùng');
  await page.locator('button[data-act="jump"]').click(); await page.keyboard.press('KeyJ'); await wait(200);
  await shot('03-keys-rebound', 'Gán Nhảy = J thành công; bảng phím hiện J');
  await click('Khôi phục mặc định'); await wait(200);
  await shot('04-keys-reset', 'Khôi phục mặc định: Nhảy = Space');
  await click('Quay lại'); await click('Quay lại'); await wait(200);
  // captions at ~5 s: first shades spawn (tick 300), L1 crosses below 30 fuel, 10 s left
  await load(1, { ...Q, random_shades: true, time_left_s: 15, lanterns: [{ id: 'L1', lit: true, fuel: 35 }] }, 180);
  await page.evaluate(() => window.ddl.step(301)); await wait(300);
  await shot('05-captions-shade-arrow', 'Phụ đề: Bóng Mực xuất hiện (+ mũi tên tím ở mép màn hình), đèn L1 < 30, 10 giây cuối');
  await load(3, { ...Q, wind_enabled: true, player: { pos: [0, 0, -30] } }, 0);
  await page.evaluate(() => window.ddl.step(1680)); await wait(200);
  await shot('06-caption-wind', 'Đêm 3: phụ đề "Gió sắp thổi" 2 s trước cơn gió');
  await page.evaluate(() => window.ddl.set({ bigText: true }));
  await load(1, { ...Q, lanterns: [{ id: 'L1', lit: true, fuel: 80 }] }, 0); await wait(400);
  await shot('07-big-text', 'Chữ lớn ×1.25 (gốc 18 px → 22.5 px)');
  await page.evaluate(() => window.ddl.set({ bigText: false }));
  const hit = { ...Q, player: { flames: 3 }, shades: [{ id: 'S1', pos: [0, 1, 0.5] }] };
  await load(1, hit, 0); await wait(90);
  await shot('08-hit-flash', 'Bị Bóng Mực chạm: chớp đỏ + rung camera (giảm chuyển động TẮT)');
  await page.evaluate(() => window.ddl.set({ reducedMotion: true }));
  await load(1, hit, 0); await wait(90);
  await shot('09-hit-reduced-motion', 'Cùng tình huống, giảm chuyển động BẬT: không chớp, không rung');
  await page.evaluate(() => window.ddl.set({ reducedMotion: false }));
  // lose -> name form -> save (server API) -> leaderboard
  await load(1, { ...Q, player: { flames: 1 }, shades: [{ id: 'S1', pos: [0, 1, 0.5] }] }, 0); await wait(600);
  await page.locator('#lbName').fill('ab'); await page.locator('#lbSave').click(); await wait(200);
  await shot('10-name-invalid', 'Thua Đêm 1 → form nhập tên; "ab" (2 ký tự) bị từ chối');
  await page.locator('#lbName').fill('Nguyễn_Bảo'); await page.locator('#lbSave').click(); await wait(600);
  await shot('11-leaderboard-saved', 'Lưu "Nguyễn_Bảo" (tiếng Việt có dấu) → Bảng xếp hạng, dòng mới tô vàng');
  for (const [name, score] of [['Bao_01', 450], ['Mây', 450], ['Zed', 1200]]) {
    await page.evaluate(([name, score]) => fetch('api/leaderboard', { method: 'POST', body: JSON.stringify({ name, score, nights_won: 2, achieved_at: new Date().toISOString().replace('Z', '+00:00'), seed: 1 }) }), [name, score]);
    await wait(50);
  }
  await page.reload(); await wait(1200);
  await click('Bảng xếp hạng'); await wait(500);
  await shot('12-leaderboard-menu', 'Menu → Bảng xếp hạng (đọc lại từ đĩa sau khi tải lại trang): điểm giảm dần, bằng điểm ai trước đứng trên');
  await browser.close(); server.kill();
}
