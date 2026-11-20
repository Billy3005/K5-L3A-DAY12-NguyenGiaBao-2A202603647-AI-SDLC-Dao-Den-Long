// Standard maps (Ticket-02 Part 2). Angles from +X, counter-clockwise seen from above: (r·cosθ, r·sinθ) on XZ.
import type { Vec3 } from './types';

const DEG = Math.PI / 180;
const ring = (r: number, y: number, degs: number[], cx = 0): Vec3[] =>
  degs.map((d) => [cx + r * Math.cos(d * DEG), y, r * Math.sin(d * DEG)]);
const every = (step: number, from = 0, count = Math.round(360 / step)) =>
  Array.from({ length: count }, (_, i) => from + i * step);

export interface Pad { pos: Vec3; vy: number; h: number; dir: [number, number] }

export interface NightMap {
  night: 1 | 2 | 3;
  name: string;
  durationS: number;
  start: Vec3;
  lanterns: Vec3[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeEvery: number; // ticks
  shadeMax: number;
  shadeSpeed: number;
  charms: Vec3[];
  pads: Pad[];
  drifters: boolean;
  wind: boolean;
  /** Top walkable surface height at (x,z), or null over the void. */
  topAt(x: number, z: number): number | null;
}

const unit = (from: [number, number], to: [number, number]): [number, number] => {
  const dx = to[0] - from[0], dz = to[1] - from[1], l = Math.hypot(dx, dz);
  return [dx / l, dz / l];
};

const night1: NightMap = {
  night: 1, name: 'Đảo Bến', durationS: 240, start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 0, every(45)), ...ring(33, 0, every(22.5))],
  shadePoints: ring(37, 0, every(30, 15)),
  shadeEvery: 480, shadeMax: 6, shadeSpeed: 4.0,
  charms: [], pads: [], drifters: false, wind: false,
  topAt: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
};

const night2: NightMap = {
  night: 2, name: 'Đảo Cau', durationS: 270, start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [
    ...ring(10, 0, every(90)), ...ring(22, 0, every(45)),
    ...ring(10, 0, every(90), 70), ...ring(22, 0, every(45), 70),
  ],
  shadePoints: [...ring(26, 0, every(45, 22.5)), ...ring(26, 0, every(45, 22.5), 70)],
  shadeEvery: 420, shadeMax: 8, shadeSpeed: 4.0,
  charms: [[35, 0, 0]],
  pads: [
    { pos: [20, 0, 18], vy: 14, h: 24, dir: unit([20, 18], [70, 0]) },
    { pos: [50, 0, -18], vy: 14, h: 24, dir: unit([50, -18], [0, 0]) },
  ],
  drifters: true, wind: false,
  topAt: (x, z) =>
    Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? 0 : null,
};

function night3Top(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 2) return 14; // bell tower (unclimbable wall)
  if (r <= 8) return 6; // tier 2
  if (r >= 12 && r <= 24 && z > 0) return 3; // tier 1
  for (const a of [30 * DEG, 150 * DEG]) {
    const ux = Math.cos(a), uz = Math.sin(a);
    const along = x * ux + z * uz, perp = Math.abs(-x * uz + z * ux);
    if (along >= 24 && along <= 30 && perp <= 1.5) return (3 * (30 - along)) / 6; // ramp
  }
  return 0;
}

const night3: NightMap = {
  // Contract: player starts at (0,0,0) (Codex decision Q13), although that is inside the bell tower column.
  // The "embedded" rule in step.ts lets the player walk out horizontally.
  night: 3, name: 'Đảo Chuông', durationS: 300, start: [0, 0, 0],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(34, 0, every(20)), ...ring(18, 3, every(20, 20, 8)), ...ring(5, 6, every(90, 45))],
  shadePoints: ring(43, 0, every(22.5)),
  shadeEvery: 360, shadeMax: 10, shadeSpeed: 4.5,
  charms: [[30, 0, 25], [-30, 0, 25]],
  pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
  drifters: true, wind: true,
  topAt: night3Top,
};

export const MAPS: Record<1 | 2 | 3, NightMap> = { 1: night1, 2: night2, 3: night3 };
