import { randomInRing } from './rng';
import { TUNING, WORLD } from './tuning';
import type { Lantern, Shade, Vec3, World } from './types';

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export class ScenarioError extends Error {}

export function defaultLanterns(): Lantern[] {
  const n = TUNING.lantern_count_night1;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      id: `L${i + 1}`,
      pos: [Math.sin(a) * WORLD.lanternRingRadius, 0, Math.cos(a) * WORLD.lanternRingRadius] as Vec3,
      lit: false,
      deposited: 0,
    };
  });
}

export function spawnMote(w: World): void {
  const [x, z] = randomInRing(w, WORLD.moteSpawnMinR, WORLD.moteSpawnMaxR);
  w.motes.push({ id: `M${w.nextMoteId++}`, pos: [x, 0, z] });
}

export function spawnShade(w: World): Shade {
  const [x, z] = randomInRing(w, WORLD.shadeSpawnR, WORLD.shadeSpawnR);
  const s: Shade = { id: `S${w.nextShadeId++}`, pos: [x, WORLD.shadeHoverY, z], state: 'chase', stunTicks: 0 };
  w.shades.push(s);
  return s;
}

/** Build the initial world (tick 0). Applying a scenario emits no events and awards no score. */
export function createWorld(seed: number, scenario: Scenario = {}): World {
  const w: World = {
    tick: 0,
    state: 'playing',
    score: 0,
    startTimeLeftS: scenario.time_left_s ?? TUNING.night1_duration_s,
    rngState: seed >>> 0,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    nextMoteId: 1,
    nextShadeId: 1,
    shadeSpawnTicks: 0,
    player: {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])] as Vec3,
      vy: 0,
      flames: scenario.player?.flames ?? TUNING.flames,
      carried: scenario.player?.carried ?? 0,
      invulnTicks: 0,
      pulseCdTicks: 0,
    },
    motes: [],
    shades: [],
    lanterns: defaultLanterns(),
    prevButtons: { jump: false, interact: false, pulse: false },
  };

  for (const l of scenario.lanterns ?? []) {
    const target = w.lanterns.find((x) => x.id === l.id);
    if (!target) throw new ScenarioError(`unknown lantern id: ${l.id}`);
    if (l.pos) target.pos = [...l.pos] as Vec3;
    if (l.deposited !== undefined) target.deposited = l.deposited;
    if (l.lit !== undefined) target.lit = l.lit;
  }

  if (scenario.motes) {
    for (const p of scenario.motes) w.motes.push({ id: `M${w.nextMoteId++}`, pos: [p[0], 0, p[2]] });
  } else if (w.randomMotes) {
    for (let i = 0; i < WORLD.initialMotes; i++) spawnMote(w);
  }

  if (scenario.shades) {
    const used = new Set(scenario.shades.map((s) => s.id).filter(Boolean));
    for (const s of scenario.shades) {
      let id = s.id;
      if (!id) {
        while (used.has(`S${w.nextShadeId}`)) w.nextShadeId++;
        id = `S${w.nextShadeId++}`;
        used.add(id);
      }
      w.shades.push({ id, pos: [...s.pos] as Vec3, state: 'chase', stunTicks: 0 });
    }
    // Later auto-spawned ids must not collide with any scenario id.
    for (const id of used) {
      const n = /^S(\d+)$/.exec(id as string);
      if (n) w.nextShadeId = Math.max(w.nextShadeId, Number(n[1]) + 1);
    }
  } else if (w.randomShades) {
    for (let i = 0; i < WORLD.initialShades; i++) spawnShade(w);
  }
  return w;
}
