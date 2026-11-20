import * as THREE from 'three';
import { createWorld } from '../sim/world';
import { step, timeLeftS } from '../sim/step';
import { TUNING, WORLD } from '../sim/tuning';
import { neutralInput, type GameEvent, type World } from '../sim/types';

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const NIGHT = new THREE.Color(0x120a26), DAWNISH = new THREE.Color(0x3a2a55);
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(0x120a26, 25, 90);
const ambient = new THREE.HemisphereLight(0x6a5aa0, 0x1a1030, 0.35);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x8090ff, 0.25); moon.position.set(-20, 40, 10); scene.add(moon);

const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius - 3, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2c3a2a, roughness: 1 }));
island.position.y = -2; scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshBasicMaterial({ color: 0x1b1238 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -6; scene.add(sea);

// player: body + nón lá + small lantern
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5b8fd6 }));
body.position.y = 0.75; player.add(body);
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0xe8c77a }));
hat.position.y = 1.65; player.add(hat);
const handLamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
handLamp.position.set(0.55, 1.3, 0.2); player.add(handLamp);
const playerLight = new THREE.PointLight(0xffa040, 6, 9); playerLight.position.set(0.5, 1.6, 0); player.add(playerLight);
scene.add(player);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false; scene.add(pulseRing);

const moteGeo = new THREE.SphereGeometry(0.15, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2a0a3a, emissive: 0x3a0a5a, emissiveIntensity: 0.6, roughness: 0.4 });
const shadeStunMat = new THREE.MeshStandardMaterial({ color: 0x6a5a8a, emissive: 0x201030, transparent: true, opacity: 0.6 });

interface LanternView { group: THREE.Group; glass: THREE.Mesh; light: THREE.PointLight }
let lanternViews: LanternView[] = [];
const moteMeshes = new Map<string, THREE.Mesh>();
const shadeMeshes = new Map<string, THREE.Mesh>();

// ---------- game state ----------
let w: World;
let pulseFx = 0;
function newGame() {
  w = createWorld((Math.random() * 2 ** 31) | 0);
  for (const v of lanternViews) scene.remove(v.group);
  for (const m of [...moteMeshes.values(), ...shadeMeshes.values()]) scene.remove(m);
  moteMeshes.clear(); shadeMeshes.clear();
  lanternViews = w.lanterns.map((l) => {
    const group = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0x4a3020 }));
    post.position.y = 1.5; group.add(post);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshStandardMaterial({ color: 0x553322, emissive: 0x000000 }));
    glass.position.y = 3.3; group.add(glass);
    const light = new THREE.PointLight(0xffa040, 0, 22); light.position.y = 3.4; group.add(light);
    group.position.set(l.pos[0], 0, l.pos[2]);
    scene.add(group);
    return { group, glass, light };
  });
  overlay.style.display = 'none';
}

// ---------- input ----------
const keys = new Set<string>();
let camYaw = 0, mouseDown = false, dragged = false, clickPulse = false;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR') newGame(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', () => { mouseDown = true; dragged = false; });
addEventListener('mousemove', (e) => { if (mouseDown) { camYaw -= e.movementX * 0.3; if (Math.abs(e.movementX) > 1) dragged = true; } });
addEventListener('mouseup', (e) => { mouseDown = false; if (!dragged && e.button === 0) clickPulse = true; });

function readInput() {
  const inp = neutralInput();
  // Screen-right while looking along camera forward is -x in contract input space (Three.js is right-handed).
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  inp.move = [x, z];
  inp.cam_yaw_deg = camYaw;
  inp.jump = keys.has('Space');
  inp.interact = keys.has('KeyE');
  inp.pulse = keys.has('KeyF') || clickPulse;
  return inp;
}

// ---------- HUD ----------
const hud = document.getElementById('hud')!;
const overlay = document.getElementById('overlay')!;
function renderHud() {
  const p = w.player;
  const lit = w.lanterns.filter((l) => l.lit).length;
  const t = Math.max(0, timeLeftS(w));
  const cd = p.pulseCdTicks > 0 ? ` (hồi ${(p.pulseCdTicks / 60).toFixed(1)}s)` : '';
  hud.innerHTML =
    `🔥 Ngọn lửa: <b>${'●'.repeat(p.flames)}${'○'.repeat(Math.max(0, TUNING.flames - p.flames))}</b><br>` +
    `✨ Đom đóm: <b>${p.carried}/${TUNING.carry_capacity}</b>${cd}<br>` +
    `🏮 Đèn: <b>${lit}/${w.lanterns.length}</b><br>` +
    `⏳ Bình minh sau: <b>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</b><br>` +
    `⭐ Điểm: <b>${w.score}</b>`;
}
function onEvents(evs: GameEvent[]) {
  for (const e of evs) {
    if (e.name === 'pulse') pulseFx = 1;
    if (e.name === 'game_over') {
      const won = e.data.result === 'won';
      (document.getElementById('title')!).textContent = won ? 'Đảo đã sáng trở lại!' : 'Ánh sáng đã tắt…';
      (document.getElementById('detail')!).textContent =
        `${won ? 'Thắp đủ 5 Đèn Lồng Lớn' : e.data.reason === 'dawn' ? 'Trời đã sáng mà đèn chưa thắp hết' : 'Mây đã hết ngọn lửa'} · Điểm: ${w.score}`;
      overlay.style.display = 'flex';
    }
  }
}

// ---------- sync visuals ----------
function sync(alpha: number) {
  const p = w.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.visible = p.invulnTicks === 0 || Math.floor(p.invulnTicks / 6) % 2 === 0;
  const yaw = (camYaw * Math.PI) / 180;
  player.rotation.y = yaw;
  camera.position.set(p.pos[0] - Math.sin(yaw) * 9, 6, p.pos[2] - Math.cos(yaw) * 9);
  camera.lookAt(p.pos[0], 1.2, p.pos[2]);

  const ids = new Set(w.motes.map((m) => m.id));
  for (const [id, m] of moteMeshes) if (!ids.has(id)) { scene.remove(m); moteMeshes.delete(id); }
  for (const m of w.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteMeshes.set(m.id, mesh); }
    mesh.position.set(m.pos[0], 0.8 + Math.sin(performance.now() / 300 + m.pos[0]) * 0.2, m.pos[2]); // hover is visual only
  }
  for (const s of w.shades) {
    let mesh = shadeMeshes.get(s.id);
    if (!mesh) { mesh = new THREE.Mesh(shadeGeo, shadeMat); scene.add(mesh); shadeMeshes.set(s.id, mesh); }
    mesh.material = s.state === 'stunned' ? shadeStunMat : shadeMat;
    mesh.position.set(s.pos[0], 1 + Math.sin(performance.now() / 250 + s.pos[2]) * 0.15, s.pos[2]);
  }
  w.lanterns.forEach((l, i) => {
    const v = lanternViews[i];
    const fill = l.lit ? 1 : l.deposited / TUNING.lantern_cost;
    (v.glass.material as THREE.MeshStandardMaterial).emissive.setHex(l.lit ? 0xffa040 : 0x442200);
    (v.glass.material as THREE.MeshStandardMaterial).emissiveIntensity = l.lit ? 1.5 : fill * 0.8;
    v.light.intensity = l.lit ? 40 : 0;
  });
  // island brightens as lanterns are lit
  const litRatio = w.lanterns.filter((l) => l.lit).length / w.lanterns.length;
  (scene.background as THREE.Color).copy(NIGHT).lerp(DAWNISH, litRatio);
  ambient.intensity = 0.35 + litRatio * 0.5;

  if (pulseFx > 0) {
    pulseRing.visible = true;
    const r = TUNING.pulse_radius * (1 - pulseFx);
    pulseRing.scale.setScalar(Math.max(0.1, r));
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = pulseFx;
    pulseFx = Math.max(0, pulseFx - alpha * 2);
  } else pulseRing.visible = false;
}

// ---------- fixed-step loop (60 tick/s, same step() as headless) ----------
newGame();
let acc = 0, last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  acc += dt;
  while (acc >= 1 / 60) {
    if (keys.has('ArrowLeft')) camYaw += 2;
    if (keys.has('ArrowRight')) camYaw -= 2;
    onEvents(step(w, readInput()));
    clickPulse = false;
    acc -= 1 / 60;
  }
  sync(dt);
  renderHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
