// Ticket-04 §1 benchmark scene (render-only entry point; headless never builds it).
import { rand } from './rng';
import { C } from './tuning';
import { createWorld, newShade } from './world';
import type { Vec3, World } from './types';

export const BENCH = { shades: 200, motes: 100, islandR: 38, lit: ['L1', 'L2', 'L3'] } as const;

/** Evenly spread points on the Night-1 disk: sunflower spiral (equal area per point) + seeded jitter (decision D6). */
function spread(w: World, n: number, y: number): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5)), turn = rand(w) * Math.PI * 2;
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const r = BENCH.islandR * Math.sqrt((i + rand(w)) / n);
    const a = turn + i * golden + (rand(w) - 0.5) * 0.3;
    out.push([Math.round(r * Math.cos(a) * 1000) / 1000, y, Math.round(r * Math.sin(a) * 1000) / 1000]);
  }
  return out;
}

/** Night 1, Mây at (0,0,0), L1–L3 lit with fuel 100, 200 wandering shades + 100 motes; no spawns. */
export function createBenchWorld(seed: number): World {
  const w = createWorld(seed, 1, {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false,
    lanterns: BENCH.lit.map((id) => ({ id, lit: true, fuel: 100 })),
    motes: [],
  });
  w.bench = true;
  for (const [i, pos] of spread(w, BENCH.shades, C.shadeHoverY).entries()) w.shades.push(newShade(`S${i + 1}`, pos, 'wander'));
  w.nextShadeId = BENCH.shades + 1;
  for (const pos of spread(w, BENCH.motes, 0)) w.motes.push({ id: `M${w.nextMoteId++}`, pos, kind: 'random', ttl: null, point: null });
  return w;
}

/** Ticket-04 §1 frame statistics from per-frame times dt (ms) inside the measured window. */
export function frameStats(dt: number[]) {
  const n = dt.length;
  if (n === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dt.reduce((a, b) => a + b, 0);
  const sorted = [...dt].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    frames: n,
    avg_fps: r1((1000 * n) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(sorted[Math.ceil(0.95 * n) - 1]), // nearest-rank (decision D2)
  };
}

/** Camera orbit (decision D5): r=30, Y=15, start (30,15,0), CCW seen from above, 15 s per lap. */
export function benchCamera(tMs: number): Vec3 {
  const a = (2 * Math.PI * tMs) / 15000;
  return [30 * Math.cos(a), 15, -30 * Math.sin(a)];
}
