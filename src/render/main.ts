// Playable client. Rules live in src/sim; this file only renders state, plays sounds and feeds inputs.
import * as THREE from 'three';
import { createWorld } from '../sim/world';
import { capacityOf, step, timeLeftS } from '../sim/step';
import { MAPS } from '../sim/maps';
import { C, TUNING } from '../sim/tuning';
import { neutralInput, type GameEvent, type World } from '../sim/types';
import { setVolume, sfx, startMusic, stopMusic } from './audio';
import { benchCamera, createBenchWorld, frameStats } from '../sim/bench';
import { insertEntry, isoLocal, validateName, type Entry } from '../leaderboard';

// ---------- palette (Ticket-02) ----------
const P = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, mote: 0xfff6c2, halo: 0xffe58a,
  shade: 0x120a1a, rim: 0x7a3cff, stunned: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};

// ---------- settings (persisted) ----------
// Ticket-04 §4: every action rebindable (KeyboardEvent.code); Escape always pauses/goes back too.
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP' };
type Action = keyof typeof DEFAULT_KEYS;
const ACTION_LABEL: Record<Action, string> = { up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa sáng', pause: 'Tạm dừng' };
const keyName = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑ ').replace('Left', ' trái').replace('Right', ' phải');
const settings = {
  volume: 0.6, sensitivity: 1, colorblind: false, bigText: false, keys: { ...DEFAULT_KEYS },
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};
try {
  const s = JSON.parse(localStorage.getItem('ddl-settings') ?? '{}');
  Object.assign(settings, s, { keys: { ...DEFAULT_KEYS, ...(s.keys ?? {}) } });
} catch { /* private mode */ }
const applySettings = () => {
  setVolume(settings.volume);
  document.documentElement.classList.toggle('big', settings.bigText);
  document.body.classList.toggle('rm', settings.reducedMotion);
};
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } applySettings(); };
applySettings();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

let scene = new THREE.Scene();
let ambient: THREE.HemisphereLight;
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

interface LanternView { group: THREE.Group; glass: THREE.Mesh; light: THREE.PointLight; bar: THREE.Mesh; barBg: THREE.Mesh; tear: THREE.Mesh }
let lanternViews: LanternView[] = [];
let player: THREE.Group, playerLight: THREE.PointLight, pulseRing: THREE.Mesh;
const pools = { motes: new Map<string, THREE.Mesh>(), shades: new Map<string, THREE.Mesh>(), drifters: new Map<string, THREE.Mesh>(), charms: new Map<string, THREE.Mesh>() };
const moteGeo = new THREE.SphereGeometry(0.16, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: P.mote });
const dropMat = new THREE.MeshBasicMaterial({ color: P.halo });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeMat = mat(P.shade, { emissive: P.shade, emissiveIntensity: 0.2 });
const rimMat = new THREE.MeshBasicMaterial({ color: P.rim, side: THREE.BackSide });
const eyeMat = new THREE.MeshBasicMaterial({ color: P.rim });
const rimColor = () => (settings.colorblind ? 0x00b3ff : P.rim); // Ticket-03 colour-blind palette
const shadeStunMat = mat(P.stunned, { transparent: true, opacity: 0.7 });
const drifterGeo = new THREE.TorusKnotGeometry(0.5, 0.08, 48, 6), drifterMat = mat(P.drifter, { emissive: P.drifter, emissiveIntensity: 0.3 });
const charmGeo = new THREE.BoxGeometry(0.5, 0.7, 0.06), charmMat = mat(P.scarf, { emissive: P.gold, emissiveIntensity: 0.25 });

function buildScene(night: 1 | 2 | 3) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(P.sky);
  scene.fog = new THREE.Fog(P.fog, 30, 120);
  ambient = new THREE.HemisphereLight(0x8090c0, 0x1b2350, 0.15);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x9aa8ff, 0.3); moon.position.set(-30, 50, 20); scene.add(moon);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshBasicMaterial({ color: P.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12; scene.add(sea);
  const disk = (r: number, y: number, x = 0, z = 0, color = P.grass) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 64), mat(color)); m.position.set(x, y - 1.5, z); scene.add(m);
  };
  if (night === 1) disk(40, 0);
  if (night === 2) {
    disk(28, 0); disk(28, 0, 70);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(P.wood)); bridge.position.set(35, -0.15, 0); scene.add(bridge);
  }
  if (night === 3) {
    disk(45, 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(12, 24, 48, 1, 0, Math.PI), mat(P.sand, { side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 3; scene.add(ring);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 3, 48, 1, true, 0, Math.PI), mat(P.sand, { side: THREE.DoubleSide }));
    wall.rotation.y = Math.PI / 2; wall.position.y = 1.5; scene.add(wall);
    disk(8, 6, 0, 0, P.sand);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(P.wood)); tower.position.y = 10; scene.add(tower);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.3, 3), mat(P.wood));
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      ramp.rotation.y = -a; ramp.rotation.z = Math.atan2(3, 6); scene.add(ramp);
    }
  }
  for (const pad of MAPS[night].pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), mat(P.gold, { emissive: P.gold, emissiveIntensity: 0.4 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]); scene.add(m);
  }
  lanternViews = MAPS[night].lanterns.map((pos) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), mat(P.wood)); post.position.y = 1.5; g.add(post);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), mat(P.off)); glass.position.y = 3.3; g.add(glass);
    const light = new THREE.PointLight(P.lit, 0, 26); light.position.y = 3.4; g.add(light);
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); barBg.position.y = 4.4; g.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), new THREE.MeshBasicMaterial({ color: P.lit, side: THREE.DoubleSide })); bar.position.y = 4.4; g.add(bar);
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0x0e1430 })); tear.position.set(0.2, 3.35, 0); tear.rotation.z = 0.6; g.add(tear);
    g.position.set(pos[0], pos[1], pos[2]); scene.add(g);
    return { group: g, glass, light, bar, barBg, tear };
  });
  // Mây: áo, khăn đỏ, nón lá, đèn nhỏ
  player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 12), mat(P.shirt, { emissive: P.shirt, emissiveIntensity: 0.35 })); body.position.y = 0.75; player.add(body);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 16), mat(P.scarf, { emissive: P.scarf, emissiveIntensity: 0.4 })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.25; player.add(scarf);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), mat(P.sand)); hat.position.y = 1.65; player.add(hat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: P.lit })); lamp.position.set(0.55, 1.3, 0.2); player.add(lamp);
  playerLight = new THREE.PointLight(P.lit, 6, 10); playerLight.position.set(0.5, 1.6, 0); player.add(playerLight);
  scene.add(player);
  pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: P.core, transparent: true, side: THREE.DoubleSide }));
  pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false; scene.add(pulseRing);
  for (const pool of Object.values(pools)) pool.clear();
}

// ---------- game flow ----------
type Mode = 'menu' | 'intro' | 'play' | 'pause' | 'result' | 'dawn' | 'settings' | 'keys' | 'board' | 'bench';
let mode: Mode = 'menu', settingsBack: Mode = 'menu';
let night: 1 | 2 | 3 = 1;
let w: World;
let wonScores: number[] = [];
let runSeed = 1; // Ticket-04 §3: night n of a run uses runSeed + n - 1; saved with the leaderboard entry
let pulseFx = 0, lastBeep = -1, shakeT = 0, last10 = false;
let rebinding: Action | null = null;
const ONG_DANG: Record<number, string> = {
  1: 'Ông Đăng: "Mây à, sương đen đã nuốt Đảo Bến. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai nửa, nối bằng cây cầu tre. Cẩn thận Gió Lạc, chúng thích ánh sáng con mang theo."',
  3: 'Ông Đăng: "Đảo Chuông cao và lộng gió. Lên dốc, nhảy bục, và giữ chặt nón lá khi gió nổi."',
};
const screen = document.getElementById('screen')!;
function show(html: string, buttons: [string, () => void][] = []) {
  screen.innerHTML = `<div class="panel">${html}</div>`;
  screen.classList.remove('hidden');
  const panel = screen.firstElementChild!;
  for (const [label, fn] of buttons) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); }; panel.appendChild(b);
  }
}
const hideScreen = () => screen.classList.add('hidden');

function goMenu() {
  mode = 'menu'; stopMusic(); wonScores = [];
  show('<h1>Đảo Đèn Lồng</h1><p>Giúp Mây thắp lại ánh sáng cho ba hòn đảo.</p>', [
    ['Bắt đầu', () => { night = 1; runSeed = (Math.random() * 2 ** 31) | 0; goIntro(); }],
    ['Bảng xếp hạng', () => { void goBoard(); }], ['Cài đặt', () => goSettings('menu')],
  ]);
}
function goIntro() {
  mode = 'intro'; buildScene(night); w = createWorld(runSeed + night - 1, night); last10 = false; lowFuel.clear(); captions.length = 0;
  show(`<h2>Đêm ${night}: ${MAPS[night].name}</h2><p class="quote">${ONG_DANG[night]}</p><p>Giữ ít nhất ${Math.ceil(C.winRatio * MAPS[night].lanterns.length - 1e-9)}/${MAPS[night].lanterns.length} đèn sáng tới bình minh (${MAPS[night].durationS / 60} phút). Đèn cạn dầu sẽ tắt: nhớ châm thêm đom đóm!</p>`,
    [['Vào đảo (Enter)', startNight]]);
}
function startNight() { mode = 'play'; hideScreen(); startMusic(); }
function goPause() {
  mode = 'pause';
  show('<h2>Tạm dừng</h2>', [['Tiếp tục', () => { mode = 'play'; hideScreen(); }], ['Chơi lại Đêm', goIntro], ['Cài đặt', () => goSettings('pause')], ['Về menu', goMenu]]);
}
function goSettings(back: Mode) {
  mode = 'settings'; settingsBack = back;
  show(`<h2>Cài đặt</h2>
    <label>Âm lượng <input id="sVol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột <input id="sSen" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>
    <label><input id="sCb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt</label>
    <label><input id="sRm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input id="sBig" type="checkbox" ${settings.bigText ? 'checked' : ''}> Chữ lớn (×1.25)</label>`,
  [['Đổi phím', goKeys], ['Quay lại', () => (settingsBack === 'pause' ? goPause() : goMenu())]]);
  const chk = (id: string, set: (v: boolean) => void) => { (document.getElementById(id) as HTMLInputElement).onchange = (e) => { set((e.target as HTMLInputElement).checked); saveSettings(); }; };
  (document.getElementById('sVol') as HTMLInputElement).oninput = (e) => { settings.volume = Number((e.target as HTMLInputElement).value); saveSettings(); };
  (document.getElementById('sSen') as HTMLInputElement).oninput = (e) => { settings.sensitivity = Number((e.target as HTMLInputElement).value); saveSettings(); };
  chk('sCb', (v) => { settings.colorblind = v; }); chk('sRm', (v) => { settings.reducedMotion = v; }); chk('sBig', (v) => { settings.bigText = v; });
}
// Ticket-04 §4 key rebinding: duplicates are refused and reported; "Khôi phục mặc định"; saved with settings.
function goKeys(msg = '') {
  mode = 'keys';
  const acts = Object.keys(DEFAULT_KEYS) as Action[];
  const dup = acts.filter((a) => acts.some((b) => b !== a && settings.keys[b] === settings.keys[a]));
  const rows = acts.map((a) => `<tr><td>${ACTION_LABEL[a]}</td><td><button class="key${dup.includes(a) ? ' dup' : ''}" data-act="${a}">${rebinding === a ? 'Nhấn phím…' : esc(keyName(settings.keys[a]))}</button></td></tr>`).join('');
  show(`<h2>Đổi phím</h2><table class="keys">${rows}</table>
    <p id="kMsg" class="msg" role="alert">${esc(msg || (dup.length ? `Trùng phím: ${dup.map((a) => ACTION_LABEL[a]).join(', ')}` : 'Bấm vào một ô rồi nhấn phím mới. Esc để hủy.'))}</p>`,
  [['Khôi phục mặc định', () => { settings.keys = { ...DEFAULT_KEYS }; rebinding = null; saveSettings(); goKeys('Đã khôi phục phím mặc định.'); }],
    ['Quay lại', () => { rebinding = null; goSettings(settingsBack); }]]);
  for (const b of screen.querySelectorAll<HTMLButtonElement>('button[data-act]')) b.onclick = () => { rebinding = b.dataset.act as Action; goKeys(`Nhấn phím mới cho "${ACTION_LABEL[rebinding]}"…`); };
}
function tryRebind(code: string) {
  const a = rebinding!; rebinding = null;
  if (code === 'Escape') { goKeys('Đã hủy.'); return; }
  const owner = (Object.keys(settings.keys) as Action[]).find((b) => b !== a && settings.keys[b] === code);
  if (owner) { goKeys(`Phím ${keyName(code)} đang dùng cho "${ACTION_LABEL[owner]}". Chọn phím khác.`); return; }
  settings.keys[a] = code; saveSettings(); goKeys(`"${ACTION_LABEL[a]}" = ${keyName(code)}`);
}

// ---------- leaderboard (Ticket-04 §3): dist/server.js stores it on disk; localStorage fallback ----------
const localBoard = (): Entry[] => { try { return JSON.parse(localStorage.getItem('ddl-board') ?? '[]'); } catch { return []; } };
async function loadBoard(): Promise<Entry[]> {
  try { const r = await fetch('api/leaderboard'); if (r.ok) return (await r.json()).entries; } catch { /* no server */ }
  return localBoard();
}
async function saveEntry(e: Entry): Promise<Entry[]> {
  try {
    const r = await fetch('api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) });
    if (r.ok) return (await r.json()).entries;
  } catch { /* no server */ }
  const list = insertEntry(localBoard(), e);
  try { localStorage.setItem('ddl-board', JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}
async function goBoard(mine?: Entry) {
  mode = 'board';
  const list = await loadBoard();
  const rows = list.map((e, i) => `<tr class="${mine && e.achieved_at === mine.achieved_at && e.name === mine.name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(isoLocal(new Date(e.achieved_at)).slice(0, 16).replace('T', ' '))}</td></tr>`).join('');
  show(`<h2>Bảng xếp hạng</h2>${list.length ? `<table class="board"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Lúc</th></tr>${rows}</table>` : '<p>Chưa có ai. Hãy là người đầu tiên!</p>'}`, [['Về menu', goMenu]]);
}
/** Name form shown after Bình Minh or any loss; score = sum of the nights won in this run. */
function nameForm() {
  const total = wonScores.reduce((a, b) => a + (b ?? 0), 0);
  return `<div class="save"><p>Lưu điểm <b>${total}</b> (${wonScores.filter((x) => x !== undefined).length} Đêm thắng)</p>
    <input id="lbName" maxlength="24" placeholder="Tên 3–12 ký tự" autocomplete="off"> <button id="lbSave">Lưu</button><p id="lbMsg" class="msg" role="alert"></p></div>`;
}
function wireNameForm() {
  const input = document.getElementById('lbName') as HTMLInputElement | null;
  if (!input) return;
  const save = async () => {
    const name = validateName(input.value.trim());
    if (!name) { $('lbMsg').textContent = 'Tên cần 3–12 ký tự: chữ (có thể có dấu), số hoặc _.'; return; }
    const e: Entry = { name, score: wonScores.reduce((a, b) => a + (b ?? 0), 0), nights_won: wonScores.filter((x) => x !== undefined).length, achieved_at: isoLocal(new Date()), seed: runSeed };
    await saveEntry(e); void goBoard(e);
  };
  ($('lbSave') as HTMLButtonElement).onclick = () => { void save(); };
  input.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') void save(); };
  input.onkeyup = (ev) => ev.stopPropagation();
}
function goResult(won: boolean, reason: string) {
  mode = 'result'; stopMusic();
  if (won) wonScores[night - 1] = w.score;
  const total = wonScores.reduce((a, b) => a + (b ?? 0), 0);
  if (won && night === 3) {
    mode = 'dawn';
    show(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Cảm ơn Mây!</p><h2>Tổng điểm: ${total}</h2>${nameForm()}`, [['Về menu', goMenu]]);
    wireNameForm();
    return;
  }
  const why = reason === 'dawn' ? 'Bình minh tới mà số đèn còn sáng chưa đủ.' : 'Mây đã hết Ngọn Lửa.';
  show(won ? `<h2>Đêm ${night} hoàn thành!</h2><p>Điểm Đêm: ${w.score} · Tổng: ${total}</p>`
    : `<h2>Đêm ${night} thất bại</h2><p>${why}</p>${nameForm()}`,
  won ? [['Đêm kế tiếp', () => { night = (night + 1) as 2 | 3; goIntro(); }], ['Về menu', goMenu]]
    : [['Chơi lại Đêm', goIntro], ['Về menu', goMenu]]);
  wireNameForm();
}

// ---------- input ----------
const keys = new Set<string>();
let camYaw = 0, dragging = false, dragged = false, clickPulse = false;
addEventListener('keydown', (e) => {
  if (rebinding) { e.preventDefault(); tryRebind(e.code); return; }
  keys.add(e.code);
  const isPause = e.code === 'Escape' || e.code === settings.keys.pause;
  if (isPause && mode === 'play') goPause();
  else if (isPause && mode === 'pause') { mode = 'play'; hideScreen(); }
  else if (e.code === 'Enter' && mode === 'intro') startNight();
});
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', () => { dragging = true; dragged = false; });
addEventListener('mousemove', (e) => { if (dragging) { camYaw -= e.movementX * 0.3 * settings.sensitivity; if (Math.abs(e.movementX) > 1) dragged = true; } });
addEventListener('mouseup', (e) => { if (dragging && !dragged && e.button === 0 && mode === 'play') clickPulse = true; dragging = false; });
function readInput() {
  const inp = neutralInput();
  // screen-right while looking along camera forward is -x in contract input space (three.js is right-handed)
  const k = settings.keys, on = (a: Action) => keys.has(k[a]);
  inp.move = [(on('left') ? 1 : 0) - (on('right') ? 1 : 0), (on('up') ? 1 : 0) - (on('down') ? 1 : 0)];
  inp.cam_yaw_deg = camYaw;
  inp.jump = on('jump'); inp.interact = on('interact');
  inp.pulse = on('pulse') || clickPulse;
  inp.dash = on('dash');
  return inp;
}

// ---------- events -> sound / screens ----------
function onEvents(evs: GameEvent[], wasGrounded: boolean) {
  if (wasGrounded && !w.player.grounded && w.player.vel[1] > 6.5 && !w.player.launch) sfx('jump');
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': sfx('pickup'); break;
      case 'lantern_lit': sfx('lit'); break;
      case 'refuel': sfx('charm'); break;
      case 'lantern_out': sfx('hit'); caption(`🏮 Đèn ${String(e.data.lantern_id)} đã tắt`, 3000); break;
      case 'pulse': sfx('pulse'); pulseFx = 1; break;
      case 'player_hit':
        sfx('hit');
        if (!settings.reducedMotion) { shakeT = 0.3; const f = $('hFlash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
        break;
      case 'dash': sfx('dash'); break;
      case 'shade_spawned': sfx('shade'); caption('👁 Bóng Mực xuất hiện!', 3000); shadeCue = { id: String(e.data.id), until: performance.now() + 3000 }; break;
      case 'charm_picked': sfx('charm'); break;
      case 'drifter_steal': sfx('steal'); break;
      case 'game_over': sfx(e.data.result === 'won' ? 'win' : 'lose'); goResult(e.data.result === 'won', String(e.data.reason)); break;
    }
  }
}

// ---------- HUD ----------
const $ = (id: string) => document.getElementById(id)!;
const shown = new Map<string, string>(); // write DOM only when the text changes (avoids per-frame layout/GC hitches)
const setHtml = (id: string, html: string) => { if (shown.get(id) !== html) { shown.set(id, html); $(id).innerHTML = html; } };
// Ticket-04 §4 captions / visual cues (queue: newest last, max 3 lines; same key refreshes instead of stacking)
const captions: { text: string; until: number; key: string }[] = [];
const lowFuel = new Set<string>();
let shadeCue: { id: string; until: number } | null = null;
function caption(text: string, ms: number, key = text) {
  const i = captions.findIndex((c) => c.key === key);
  if (i >= 0) captions.splice(i, 1);
  captions.push({ text, until: performance.now() + ms, key });
}
/** Place an arrow at the screen edge pointing at a world position (always if `always`, else only when off-screen). */
function edgeArrow(el: HTMLElement, x: number, y: number, z: number, always: boolean) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  const off = v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
  if (!off && !always) { el.style.display = 'none'; return; }
  let px = v.x, py = v.y; if (v.z > 1) { px = -px; py = -py; }
  const ang = Math.atan2(px, py), r = 0.85;
  const sx = (0.5 + Math.sin(ang) * r * 0.5) * innerWidth, sy = (0.5 - Math.cos(ang) * r * 0.5) * innerHeight;
  Object.assign(el.style, { display: 'block', left: `${sx - 14}px`, top: `${sy - 15}px`, transform: `rotate(${ang}rad)` });
}
function renderCues(t: number) {
  const now = performance.now();
  if (mode === 'play' && t <= 10 && t > 0 && !last10) { last10 = true; caption('⏳ 10 giây cuối!', 10000, 'last10'); }
  for (const l of w.lanterns) { // caption once when a lit lantern crosses below 30 fuel
    const low = l.lit && l.fuel < C.lowFuelU;
    if (low && !lowFuel.has(l.id)) { lowFuel.add(l.id); caption(`⚠ Đèn ${l.id} sắp cạn dầu (< ${TUNING.low_fuel_threshold})`, 4000, `low${l.id}`); }
    else if (!low) lowFuel.delete(l.id);
  }
  while (captions.length && captions[0].until < now) captions.shift();
  for (let i = captions.length - 1; i >= 0; i--) if (captions[i].until < now) captions.splice(i, 1);
  setHtml('hCap', captions.slice(-3).map((c) => `<div>${esc(c.text)}</div>`).join(''));
  const s = shadeCue && shadeCue.until > now ? w.shades.find((x) => x.id === shadeCue!.id) : undefined;
  if (s) edgeArrow($('hShade'), s.pos[0], s.pos[1], s.pos[2], true); else $('hShade').style.display = 'none';
}
function renderHud() {
  const p = w.player, t = Math.max(0, timeLeftS(w));
  setHtml('hFlames', '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, TUNING.flames - p.flames)));
  const timer = $('hTimer');
  const clock = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  timer.classList.toggle('danger', t <= 30);
  document.body.classList.toggle('cb', settings.colorblind);
  setHtml('hTimer', t <= 30 && settings.colorblind ? '⚠ ' + clock : clock);
  const lit = w.lanterns.filter((l) => l.lit).length;
  const need = Math.ceil(C.winRatio * w.lanterns.length - 1e-9);
  setHtml('hRight', `🏮 ${lit}/${w.lanterns.length} <small>(cần ${need})</small><br><span class="score">${w.score}</span>${p.charmTicks > 0 ? `<br><span style="color:#C8102E">Bùa Gió ${(p.charmTicks / 60).toFixed(0)}s</span>` : ''}`);
  const cap = capacityOf(w);
  if ($('hMotes').children.length !== cap + 1) $('hMotes').innerHTML = '<i></i>'.repeat(cap) + '<span></span>';
  [...$('hMotes').children].forEach((el, i) => el.classList.toggle('on', i < p.carried));
  ($('hMotes').lastElementChild as HTMLElement).textContent = ` ${p.carried}/${cap}`;
  const cd = (id: string, ticks: number, total: number) => { (($(id).querySelector('b')) as HTMLElement).style.height = `${(100 * ticks) / total}%`; };
  cd('cdDash', p.charmTicks > 0 ? 0 : p.dashCdTicks, C.dashCdTicks); cd('cdPulse', p.pulseCdTicks, C.pulseCdTicks);
  // prompt near an unlit lantern
  const near = w.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  const prompt = $('hPrompt');
  prompt.style.display = near ? 'block' : 'none';
  if (near) prompt.textContent = `${keyName(settings.keys.interact)} — Nạp ánh sáng (${near.deposited}/${near.everLit ? C.relightCost : C.firstLightCost})`;
  const refuel = !near && w.lanterns.find((l) => l.lit && l.fuel < C.fuelMaxU && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  if (refuel) { prompt.style.display = 'block'; prompt.textContent = `${keyName(settings.keys.interact)} — Châm dầu (${Math.floor(refuel.fuel / C.fuelUnit)}/100)`; }
  // arrow to nearest unlit lantern when off-screen
  const arrow = $('hArrow');
  const target = w.lanterns.filter((l) => !l.lit).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  if (target && mode !== 'bench') edgeArrow(arrow, target.pos[0], target.pos[1] + 3, target.pos[2], false); else arrow.style.display = 'none';
  renderCues(t);
  // countdown beep in the last 10 s
  const sec = Math.ceil(t);
  if (mode === 'play' && t <= 10 && t > 0 && sec !== lastBeep) { lastBeep = sec; sfx('tick'); }
}

// ---------- sync visuals ----------
function syncPool<T extends { id: string; pos: number[] }>(pool: Map<string, THREE.Mesh>, items: T[], make: (it: T) => THREE.Mesh, update: (m: THREE.Mesh, it: T) => void) {
  const ids = new Set(items.map((i) => i.id));
  for (const [id, m] of pool) if (!ids.has(id)) { scene.remove(m); pool.delete(id); }
  for (const it of items) {
    let m = pool.get(it.id);
    if (!m) { m = make(it); scene.add(m); pool.set(it.id, m); }
    update(m, it);
  }
}
function sync(dt: number) {
  const p = w.player, now = performance.now();
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.visible = p.fallWaitTicks === 0 && (p.invulnTicks === 0 || Math.floor(p.invulnTicks / 6) % 2 === 0);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  const yaw = (camYaw * Math.PI) / 180;
  if (mode === 'bench') {
    const c = benchCamera(now - benchT0); camera.position.set(c[0], c[1], c[2]); camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(p.pos[0] - Math.sin(yaw) * 9, Math.max(p.pos[1], -2) + 6, p.pos[2] - Math.cos(yaw) * 9);
    camera.lookAt(p.pos[0], Math.max(p.pos[1], -2) + 1.2, p.pos[2]);
    if (shakeT > 0) { // hit shake (render-only, off with reduced motion)
      const a = 0.25 * (shakeT / 0.3);
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a;
      shakeT = Math.max(0, shakeT - dt);
    }
  }
  syncPool(pools.motes, w.motes, (m) => new THREE.Mesh(moteGeo, m.kind === 'dropped' ? dropMat : moteMat),
    (mesh, m) => mesh.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(now / 300 + m.pos[0]) * 0.2, m.pos[2]));
  rimMat.color.setHex(rimColor()); eyeMat.color.setHex(rimColor());
  syncPool(pools.shades, w.shades, () => {
    const m = new THREE.Mesh(shadeGeo, shadeMat);
    const rim = new THREE.Mesh(shadeGeo, rimMat); rim.scale.setScalar(1.12); m.add(rim);
    for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat); e.position.set(x, 0.2, 0.72); m.add(e); }
    return m;
  }, (mesh, s) => {
    mesh.material = s.state === 'stunned' ? shadeStunMat : shadeMat;
    mesh.scale.setScalar(s.state === 'spawning' ? 0.4 + 0.6 * (1 - s.stateTicks / C.spawningTicks) : 1);
    mesh.position.set(s.pos[0], s.pos[1] + Math.sin(now / 250 + s.pos[2]) * 0.15, s.pos[2]);
  });
  syncPool(pools.drifters, w.drifters.filter((d) => d.state !== 'removed'), () => new THREE.Mesh(drifterGeo, drifterMat), (mesh, d) => {
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]); mesh.rotation.y = now / 200;
  });
  syncPool(pools.charms, w.charms, () => new THREE.Mesh(charmGeo, charmMat), (mesh, c) => {
    mesh.visible = c.available; mesh.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]); mesh.rotation.y = now / 400;
  });
  const blinkOff = Math.floor(now / 500) % 2 === 1; // 1 Hz slow blink
  w.lanterns.forEach((l, i) => {
    const v = lanternViews[i]; if (!v) return;
    v.group.position.set(l.pos[0], l.pos[1], l.pos[2]); // follow the sim (scenarios may move lanterns)
    const m = v.glass.material as THREE.MeshStandardMaterial;
    const fuel = l.fuel / C.fuelUnit, low = l.lit && fuel < TUNING.low_fuel_threshold;
    const cost = l.everLit ? C.relightCost : C.firstLightCost;
    m.color.setHex(l.lit ? P.lit : P.off);
    m.emissive.setHex(l.lit ? P.core : P.lit);
    m.emissiveIntensity = l.lit ? (low && blinkOff ? 0.3 : 1.2) : (l.deposited / cost) * 0.6;
    v.light.intensity = l.lit ? (low && blinkOff ? 12 : 40) : 0;
    v.glass.scale.set(1, l.lit ? 1 : 0.8, 1); // unlit: squashed 20% + torn paper (shape cue, not colour)
    v.tear.visible = !l.lit;
    v.bar.visible = v.barBg.visible = l.lit && !(low && blinkOff);
    v.bar.scale.x = Math.max(0.001, fuel / TUNING.fuel_max); v.bar.position.x = -0.8 * (1 - v.bar.scale.x);
    (v.bar.material as THREE.MeshBasicMaterial).color.setHex(low ? (settings.colorblind ? 0xffffff : 0xff5a5f) : P.lit);
  });
  ambient.intensity = 0.15 + 0.55 * (w.lanterns.filter((l) => l.lit).length / w.lanterns.length); // Ticket-02 formula
  if (pulseFx > 0) {
    pulseRing.visible = true;
    pulseRing.scale.setScalar(Math.max(0.1, TUNING.pulse_radius * (1 - pulseFx)));
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = pulseFx;
    pulseFx = Math.max(0, pulseFx - dt * 2);
  } else pulseRing.visible = false;
}

// ---------- loop: fixed 60 tick/s, same step() as headless ----------
let acc = 0, last = performance.now(), fpsFrames = 0, fpsT = last, fps = 0, windWarned = -1;
function tickOnce(inp: ReturnType<typeof readInput>) {
  const wasGrounded = w.player.grounded;
  onEvents(step(w, inp), wasGrounded);
  if (MAPS[night].wind && w.simTick % C.windEvery === C.windEvery - 120 && windWarned !== w.simTick) { windWarned = w.simTick; sfx('wind'); caption('🍃 Gió sắp thổi!', 2000, 'wind'); }
}
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (mode === 'play') {
    acc += dt;
    while (acc >= 1 / 60 && mode === 'play') {
      if (keys.has('ArrowLeft')) camYaw += 2 * settings.sensitivity;
      if (keys.has('ArrowRight')) camYaw -= 2 * settings.sensitivity;
      tickOnce(readInput());
      clickPulse = false;
      acc -= 1 / 60;
    }
  } else if (mode === 'bench') {
    acc += dt;
    while (acc >= 1 / 60) { step(w, neutralInput()); acc -= 1 / 60; } // no player input; rules per bench flag
  } else acc = 0;
  if (w) { sync(dt); renderHud(); }
  renderer.render(scene, camera);
  if (mode === 'bench') benchFrame(now);
  fpsFrames++;
  if (now - fpsT >= 1000) { fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now; $('hInfo').textContent = `${fps.toFixed(0)} FPS · ${innerWidth}×${innerHeight} · Đêm ${night}`; }
  requestAnimationFrame(frame);
}

// ---------- Ticket-04 §1 bench scene: ?bench=1&seed=42&duration=30 (driven by scripts/bench.mjs) ----------
const qs = new URLSearchParams(location.search);
const benchCfg = { seed: Number(qs.get('seed') ?? 42), duration: Number(qs.get('duration') ?? 30), warmup: 3000 };
let benchT0 = 0, benchPrev = 0, benchDone = false, heapPeak = 0;
const benchDt: number[] = [];
type BenchWin = { __benchFirstFrame?: () => void; __benchDone?: (r: unknown) => void; benchResult?: unknown };
function benchFrame(now: number) {
  const bw = window as unknown as BenchWin;
  if (benchT0 === 0) { benchT0 = now; benchPrev = now; bw.__benchFirstFrame?.(); return; }
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (mem) heapPeak = Math.max(heapPeak, mem.usedJSHeapSize);
  const start = benchT0 + benchCfg.warmup;
  if (now > start && !benchDone) {
    benchDt.push(now - Math.max(benchPrev, start)); // first measured frame counts only its part after warm-up
    if (now - start >= benchCfg.duration * 1000) {
      benchDone = true;
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      bw.benchResult = {
        ...frameStats(benchDt), js_heap_peak_mb: mem ? Math.round(heapPeak / 1048576) : null,
        gl: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
        three: THREE.REVISION, shades: w.shades.length, motes: w.motes.length,
      };
      bw.__benchDone?.(bw.benchResult);
    }
  }
  benchPrev = now;
}

if (qs.has('bench')) {
  night = 1; buildScene(1); w = createBenchWorld(benchCfg.seed); mode = 'bench'; hideScreen();
} else {
  buildScene(1);
  w = createWorld(1, 1);
  goMenu();
}
requestAnimationFrame(frame);
// Evidence hooks (render-only; used by scripts/shots.mjs and the console). load() builds the world
// from a contract scenario with the same createWorld() as headless, so screenshots show real sim states.
(window as unknown as { ddl: unknown }).ddl = {
  fps: () => fps,
  load(n: 1 | 2 | 3, scenario: Parameters<typeof createWorld>[2] = {}, yawDeg = 0) {
    night = n; wonScores = []; buildScene(n); w = createWorld(1, n, scenario);
    camYaw = yawDeg; mode = 'play'; hideScreen(); last10 = false; lowFuel.clear(); captions.length = 0;
  },
  setColorblind(on: boolean) { settings.colorblind = on; saveSettings(); },
  /** Fast-forward n sim ticks with no input through the same path as play (events, captions). */
  step(n: number) { for (let i = 0; i < n && mode === 'play'; i++) tickOnce(neutralInput()); },
  set(s: Partial<typeof settings>) { Object.assign(settings, s); saveSettings(); },
};
