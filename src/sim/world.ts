import { rand } from './rng';
import { C, TUNING } from './tuning';
import { MAPS, type NightMap } from './maps';
import type { Charm, Drifter, DrifterState, Mote, Shade, ShadeState, Vec3, World } from './types';

export interface Scenario {
  player?: {
    pos?: Vec3; carried?: number; flames?: number;
    invuln_ticks?: number; dash_cd_ticks?: number; pulse_cd_ticks?: number; charm_ticks?: number; successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number; state_ticks_left?: number }[];
  charms?: { id: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean; fuel?: number; ever_lit?: boolean }[];
  time_left_s?: number;
}

export class ScenarioError extends Error {}

export const mapOf = (w: World): NightMap => MAPS[w.night];
export const idNum = (id: string) => Number(/\d+$/.exec(id)?.[0] ?? 0);

export function newShade(id: string, pos: Vec3, state: ShadeState = 'wander', stateTicks = 0, target: string | null = null): Shade {
  return { id, pos: [...pos] as Vec3, state, stateTicks, pushTicks: 0, pushDir: [1, 0], recoilDir: [1, 0], evictTicks: 0, evictFrom: null, evictStep: 0, target, drainTicks: 0 };
}

export function newDrifter(id: string, pos: Vec3, state: DrifterState = 'idle', stolen = 0, stateTicks = 0): Drifter {
  // idle drifters circle `home`; start on the circle at angle 0
  return { id, pos: [...pos] as Vec3, state, stateTicks, stolen, home: [pos[0] - C.drifterIdleR, pos[2]], angle: 0, fleeSetTick: -1 };
}

/** Pick a random free spawn point index (no random mote on it), or -1. */
export function freeMotePoint(w: World): number {
  const pts = mapOf(w).motePoints;
  const used = new Set(w.motes.filter((m) => m.kind === 'random').map((m) => m.point));
  const free = pts.map((_, i) => i).filter((i) => !used.has(i));
  return free.length ? free[Math.floor(rand(w) * free.length)] : -1;
}

export function spawnRandomMote(w: World, point: number): Mote {
  const p = mapOf(w).motePoints[point];
  const m: Mote = { id: `M${w.nextMoteId++}`, pos: [...p] as Vec3, kind: 'random', ttl: null, point };
  w.motes.push(m);
  return m;
}

/** Build the initial world (tick 0). Applying a scenario emits no events and awards no score. */
export function createWorld(seed: number, night: 1 | 2 | 3 = 1, scenario: Scenario = {}): World {
  const map = MAPS[night];
  const sp = scenario.player ?? {};
  const w: World = {
    night,
    tick: 0,
    simTick: 0,
    paused: false,
    state: 'playing',
    score: 0,
    startTimeLeftS: scenario.time_left_s ?? map.durationS,
    rngState: seed >>> 0,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: scenario.random_drifters ?? true,
    windEnabled: scenario.wind_enabled ?? true,
    wind: { ticks: 0, dirDeg: null },
    nextMoteId: 1,
    nextShadeId: 1,
    nextDrifterId: 1,
    player: {
      pos: [...(sp.pos ?? map.start)] as Vec3,
      vel: [0, 0, 0],
      grounded: true,
      facing: [0, 1],
      flames: sp.flames ?? TUNING.flames,
      carried: sp.carried ?? 0,
      invulnTicks: sp.invuln_ticks ?? 0,
      pulseCdTicks: sp.pulse_cd_ticks ?? 0,
      dashCdTicks: sp.dash_cd_ticks ?? 0,
      dashTicks: 0,
      dashDir: [0, 1],
      charmTicks: sp.charm_ticks ?? 0,
      launch: null,
      fallWaitTicks: 0,
      successfulLights: sp.successful_lights ?? 0,
    },
    motes: [],
    shades: [],
    drifters: [],
    charms: map.charms.map((pos, i): Charm => ({ id: `C${i + 1}`, pos: [...pos] as Vec3, available: true, respawnTicks: 0 })),
    lanterns: map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos] as Vec3, lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0 })),
    prevButtons: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  // A scenario-placed player above the surface starts airborne; on (or embedded in) terrain counts as grounded.
  const top = map.topAt(w.player.pos[0], w.player.pos[2]);
  w.player.grounded = top !== null && top >= w.player.pos[1] - 1e-6;

  for (const l of scenario.lanterns ?? []) {
    const t = w.lanterns.find((x) => x.id === l.id);
    if (!t) throw new ScenarioError(`unknown lantern id: ${l.id}`);
    if (l.pos) t.pos = [...l.pos] as Vec3;
    if (l.deposited !== undefined) t.deposited = l.deposited;
    if (l.lit !== undefined) t.lit = l.lit;
    if (l.ever_lit !== undefined) t.everLit = l.ever_lit;
    // Ticket-03: lit without fuel -> 100; a lit lantern has (obviously) been lit; unlit lanterns hold no fuel
    if (t.lit) { t.everLit = true; t.fuel = Math.round((l.fuel ?? TUNING.fuel_max) * C.fuelUnit); if (t.fuel <= 0) { t.lit = false; t.fuel = 0; } }
    else t.fuel = 0;
  }

  if (scenario.motes) {
    for (const p of scenario.motes) w.motes.push({ id: `M${w.nextMoteId++}`, pos: [...p] as Vec3, kind: 'random', ttl: null, point: null });
  } else if (w.randomMotes) {
    for (let i = 0; i < C.moteStart; i++) {
      const pt = freeMotePoint(w);
      if (pt >= 0) spawnRandomMote(w, pt);
    }
  }

  if (scenario.shades) {
    const used = new Set(scenario.shades.map((s) => s.id).filter(Boolean) as string[]);
    for (const s of scenario.shades) {
      let id = s.id;
      if (!id) { while (used.has(`S${w.nextShadeId}`)) w.nextShadeId++; id = `S${w.nextShadeId++}`; used.add(id); }
      if (s.target_lantern_id && !w.lanterns.some((l) => l.id === s.target_lantern_id)) throw new ScenarioError(`unknown target_lantern_id: ${s.target_lantern_id}`);
      w.shades.push(newShade(id, s.pos, s.state ?? 'wander', s.state_ticks_left ?? defaultStateTicks(s.state), s.target_lantern_id ?? null));
    }
    for (const id of used) w.nextShadeId = Math.max(w.nextShadeId, idNum(id) + 1);
  }

  if (scenario.drifters) {
    const used = new Set(scenario.drifters.map((d) => d.id).filter(Boolean) as string[]);
    for (const d of scenario.drifters) {
      let id = d.id;
      if (!id) { while (used.has(`D${w.nextDrifterId}`)) w.nextDrifterId++; id = `D${w.nextDrifterId++}`; used.add(id); }
      const st = d.state ?? 'idle';
      const ticks = d.state_ticks_left ?? (st === 'flee' ? (d.stolen ? C.drifterFleeTicks : C.drifterDropFleeTicks) : 0);
      w.drifters.push(newDrifter(id, d.pos, st, d.stolen ?? 0, ticks));
    }
    for (const id of used) w.nextDrifterId = Math.max(w.nextDrifterId, idNum(id) + 1);
  }

  if (scenario.charms) {
    w.charms = scenario.charms.map((c, i) => {
      const def = w.charms.find((x) => x.id === c.id);
      const pos = c.pos ?? def?.pos ?? map.charms[i];
      if (!pos) throw new ScenarioError(`charm ${c.id} needs pos on night ${night}`);
      const available = c.available ?? true;
      return { id: c.id, pos: [...pos] as Vec3, available, respawnTicks: available ? 0 : (c.respawn_ticks ?? C.charmRespawnTicks) };
    });
  }
  return w;
}

function defaultStateTicks(state?: ShadeState): number {
  if (state === 'stunned') return C.stunTicks;
  if (state === 'recoil') return C.recoilTicks;
  if (state === 'spawning') return C.spawningTicks;
  return 0;
}
