// Demo video (Ticket-04 §7): records the built game in a real 1280×720 Chrome window with Playwright.
// Gameplay is driven by scripted keyboard input (labelled on screen); evidence cards show real command output.
// Usage: npm run build && node scripts/demo.mjs <evidence-dir> <out.webm>
//   <evidence-dir> holds t-test.txt, t-headless.txt, t-verify.txt, t-soak.txt captured from real runs.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const [evDir, outFile] = process.argv.slice(2);
if (!evDir || !outFile) { console.error('usage: node scripts/demo.mjs <evidence-dir> <out.webm>'); process.exit(1); }
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* shared install */ }
  return createRequire(join(process.env.PW_TOOLS_DIR ?? join(homedir(), 'pw-tools'), 'package.json'))('playwright');
}
const PORT = 4520, board = join(tmpdir(), `ddl-demo-board-${Date.now()}.json`);
const server = spawn(process.execPath, ['dist/server.js', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'pipe', env: { ...process.env, LEADERBOARD_FILE: board } });
await new Promise((res) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()));

const { chromium } = await loadPlaywright();
const vidDir = join(tmpdir(), `ddl-demo-${Date.now()}`); mkdirSync(vidDir, { recursive: true });
let browser;
for (const channel of ['chrome', 'msedge', undefined]) { try { browser = await chromium.launch({ channel, headless: false, args: ['--window-size=1280,800'] }); break; } catch { /* next */ } }
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vidDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const URL0 = `http://127.0.0.1:${PORT}/`;
const Q = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], drifters: [], charms: [] };
const load = (n, sc, yaw = 0) => page.evaluate(([n, sc, yaw]) => window.ddl.load(n, sc, yaw), [n, sc, yaw]);
const set = (s) => page.evaluate((s) => window.ddl.set(s), s);
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); };
const note = (text) => page.evaluate((text) => {
  let el = document.getElementById('demoNote');
  if (!el) { el = document.createElement('div'); el.id = 'demoNote'; Object.assign(el.style, { position: 'fixed', left: '16px', top: '64px', zIndex: 20, background: '#000000cc', color: '#FFE58A', padding: '8px 14px', borderRadius: '8px', font: '600 18px system-ui', maxWidth: '520px', pointerEvents: 'none' }); document.body.appendChild(el); }
  el.textContent = text;
}, text);
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const card = async (title, body, ms) => {
  await page.setContent(`<body style="margin:0;background:#0E1430;color:#F5F1E6;font:18px system-ui;padding:40px 56px">
    <h1 style="color:#FFB347;margin:0 0 16px;font-size:34px">${title}</h1>${body}</body>`);
  await wait(ms);
};
const term = (cmdFile, label) => `<p style="color:#F2C14E">${label}</p><pre style="background:#05070f;border:1px solid #F2C14E55;border-radius:10px;padding:16px;font:15px/1.45 Consolas,monospace;white-space:pre-wrap;max-height:560px;overflow:hidden">${esc(readFileSync(join(evDir, cmdFile), 'utf8'))}</pre>`;

try {
  await card('Đảo Đèn Lồng v1.0.0: demo', `<p>Bài lab Day 12 AI SDLC · Nguyễn Gia Bảo · 2A202603647</p>
    <ul style="line-height:1.9"><li>Bản chơi web (Three.js), chạy bằng <code>npm start</code> (node dist/server.js)</li>
    <li>Phần chơi dưới đây được <b>điều khiển bằng input tự động</b> (Playwright gửi phím) trong cửa sổ Chrome 1280×720 thật</li>
    <li>Cuối video: output thật của test, headless, verify, soak, bench</li></ul>`, 5000);

  await page.goto(URL0); await wait(1500);
  await note('Menu chính: Bắt đầu / Bảng xếp hạng / Cài đặt');
  await wait(2000); await click('Bắt đầu'); await wait(3500);
  await page.keyboard.press('Enter'); await wait(300);
  await note('Đêm 1: đi lại (W A S D), xoay camera (← →), nhảy (Space), lướt (Shift)');
  await hold(['KeyW'], 2500); await hold(['ArrowLeft'], 900); await hold(['KeyW'], 2000);
  await page.keyboard.press('Space'); await hold(['KeyW', 'KeyD'], 1500);
  await page.keyboard.down('KeyW'); await page.keyboard.press('ShiftLeft'); await wait(1200); await page.keyboard.up('KeyW');
  await hold(['ArrowRight'], 1200); await hold(['KeyW'], 2000); await wait(800);

  await load(1, { ...Q, player: { pos: [0, 0, 0], carried: 14, successful_lights: 2 },
    lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, { id: 'L2', pos: [-5, 0, 9], lit: true, fuel: 31 }, { id: 'L3', pos: [5, 0, 9], lit: true, fuel: 80 }] }, 0);
  await note('Thắp đèn: đứng cạnh L1, nhấn E (tốn 10 đom đóm, +100 điểm)');
  await wait(1800); await page.keyboard.press('KeyE'); await wait(2500);
  await note('Đèn L2 tụt dưới 30 dầu: nhấp nháy 1 Hz, mất vùng an toàn, có phụ đề');
  await wait(6000);

  await load(1, { ...Q, random_shades: true, player: { pos: [0, 0, 0], carried: 8 } }, 0);
  await page.evaluate(() => window.ddl.step(240));
  await note('Bóng Mực xuất hiện: phụ đề và mũi tên tím ở mép màn hình chỉ hướng');
  await wait(5000);
  await load(1, { ...Q, player: { pos: [0, 0, 0], carried: 8 }, shades: [{ id: 'S1', pos: [0, 1, 7], state: 'chase' }, { id: 'S2', pos: [2, 1, 8], state: 'chase' }] }, 0);
  await note('Bóng Mực đuổi theo: nhấn F để Tỏa Sáng (choáng 2 s, bị đẩy lùi 4 m)');
  await wait(900); await page.keyboard.press('KeyF'); await wait(2200);
  await load(1, { ...Q, player: { flames: 3 }, shades: [{ id: 'S1', pos: [0, 1, 2.5], state: 'chase' }] }, 0);
  await note('Bị chạm: mất 1 Ngọn Lửa (còn 2), chớp đỏ và rung camera, bất tử 1,5 s');
  await wait(1800);

  await load(2, { ...Q, player: { pos: [20, 0, 10] } }, 60);
  await note('Đêm 2 Đảo Cau: hai đảo, cầu tre, bục nhảy');
  await hold(['ArrowLeft'], 2500);
  await load(3, { ...Q, player: { pos: [0, 0, -30] } }, 0);
  await note('Đêm 3 Đảo Chuông: tầng, dốc, tháp chuông, gió');
  await hold(['ArrowRight'], 2500);

  await note('Cài đặt dễ tiếp cận');
  await page.keyboard.press('Escape'); await wait(800); await click('Cài đặt'); await wait(1500);
  await click('Đổi phím'); await wait(800);
  await note('Đổi phím: gán Nhảy = F (trùng Tỏa sáng) bị từ chối và báo lỗi');
  await page.locator('button[data-act="jump"]').click(); await wait(500); await page.keyboard.press('KeyF'); await wait(2500);
  await note('Gán Nhảy = J được; "Khôi phục mặc định" đưa về Space');
  await page.locator('button[data-act="jump"]').click(); await wait(400); await page.keyboard.press('KeyJ'); await wait(1500);
  await click('Khôi phục mặc định'); await wait(1500);
  await click('Quay lại'); await wait(500);
  await note('Chữ lớn ×1.25 và Giảm chuyển động');
  await page.locator('#sBig').check(); await wait(1500); await page.locator('#sBig').uncheck(); await wait(500);
  await page.locator('#sRm').check(); await wait(1000);
  await load(1, { ...Q, player: { flames: 3 }, shades: [{ id: 'S1', pos: [0, 1, 0.5] }] }, 0);
  await note('Giảm chuyển động BẬT: bị chạm nhưng không chớp đỏ, không rung'); await wait(2500);
  await set({ reducedMotion: false });

  await load(1, { ...Q, player: { flames: 1 }, shades: [{ id: 'S1', pos: [0, 1, 0.5] }] }, 0); await wait(800);
  await note('Thua Đêm: nhập tên để lưu điểm (3–12 ký tự, có dấu tiếng Việt)');
  await page.locator('#lbName').pressSequentially('Nguyễn_Bảo', { delay: 120 }); await wait(600);
  await page.locator('#lbSave').click(); await wait(3000);
  await click('Về menu'); await wait(800); await click('Bảng xếp hạng'); await wait(2500);

  await page.goto(`${URL0}?bench=1&seed=42&duration=8`); await wait(500);
  await note('Cảnh benchmark: 200 Bóng Mực wander, 100 đom đóm, camera bay vòng r 30 m, 15 s/vòng');
  await wait(10000);

  await card('Bằng chứng: kiểm thử', term('t-test.txt', 'Output thật của <code>npm test</code> (vitest), 20/11/2026'), 9000);
  await card('Bằng chứng: headless', term('t-headless.txt', 'Contract v1.3: JSONL tất định, dòng <code>end</code> cuối') + term('t-verify.txt', '22 scenario Phase 1–3 chạy qua CLI thật, mỗi scenario 2 lần'), 9000);
  await card('Bằng chứng: soak và bench', term('t-soak.txt', 'Soak 10 Đêm: 0 crash, RSS 1,11× (ngưỡng ≤ 1,2×)') + term('bench.json', 'bench.json: 30 s, cửa sổ Chrome thật, iGPU Intel UHD (ngưỡng avg ≥ 60, 1% low ≥ 30, load ≤ 10 s)'), 10000);
  await card('Cảm ơn!', '<p>Repo, Release v1.0.0, README (cài đặt 3 lệnh), CHANGELOG, retro: xem GitHub.</p>', 3000);
} finally {
  await page.close(); await ctx.close(); await browser.close(); server.kill();
  rmSync(board, { force: true });
  const f = readdirSync(vidDir).find((x) => x.endsWith('.webm'));
  renameSync(join(vidDir, f), outFile);
  console.log('video ->', outFile);
}
