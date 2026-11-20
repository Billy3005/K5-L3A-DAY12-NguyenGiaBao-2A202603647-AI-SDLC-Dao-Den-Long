import { spawnMote, spawnShade } from './world';
import { TUNING, WORLD } from './tuning';
import type { GameEvent, InputState, Lantern, Shade, Vec3, World } from './types';

const T = TUNING;
const secToTicks = (s: number) => Math.round(s * WORLD.tickRate);

export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function timeLeftS(w: World): number {
  return w.startTimeLeftS - w.tick / WORLD.tickRate;
}

/** Contract movement: rotate input [x,z] by cam yaw, normalize if longer than 1. */
export function moveDir(move: [number, number], camYawDeg: number): [number, number] {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  const th = (camYawDeg * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}

function clampToIsland(p: Vec3): void {
  const r = Math.hypot(p[0], p[2]);
  if (r > WORLD.islandRadius) {
    p[0] *= WORLD.islandRadius / r;
    p[2] *= WORLD.islandRadius / r;
  }
}

/** Shades may not be within safe_radius of a lit lantern: push them just outside.
 *  Repeated passes resolve overlapping zones (a push out of one may land inside another). */
function enforceSafeZones(s: Shade, lanterns: Lantern[]): void {
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const l of lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.pos, l.pos);
      if (d <= T.safe_radius) {
        const [dx, dz] = d > 1e-9 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
        s.pos[0] = l.pos[0] + dx * (T.safe_radius + 0.01);
        s.pos[2] = l.pos[2] + dz * (T.safe_radius + 0.01);
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/**
 * Advance one tick (step k reads input of tick k, produces state k+1; events get tick k+1).
 * Order: timers -> move/jump -> pickup -> interact -> pulse -> shades -> hits -> spawns -> game over.
 */
export function step(w: World, input: InputState): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.state !== 'playing') return events;
  const tick = w.tick + 1;
  const emit = (name: string, data: Record<string, unknown>) => events.push({ type: 'event', tick, name, data });
  const p = w.player;
  const rise = (k: 'jump' | 'interact' | 'pulse') => input[k] && !w.prevButtons[k];

  // timers
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.pulseCdTicks > 0) p.pulseCdTicks--;

  // move + jump (jump is cosmetic for rules: all distances are XZ)
  const [dx, dz] = moveDir(input.move, input.cam_yaw_deg);
  p.pos[0] += (dx * T.player_speed) / WORLD.tickRate;
  p.pos[2] += (dz * T.player_speed) / WORLD.tickRate;
  clampToIsland(p.pos);
  if (rise('jump') && p.pos[1] <= 0) p.vy = WORLD.jumpSpeed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= WORLD.gravity / WORLD.tickRate;
    p.pos[1] += p.vy / WORLD.tickRate;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // pickup (automatic)
  for (let i = 0; i < w.motes.length && p.carried < T.carry_capacity; ) {
    if (distXZ(p.pos, w.motes[i].pos) <= T.pickup_radius) {
      w.motes.splice(i, 1);
      p.carried++;
      w.score += T.score.per_mote;
      emit('mote_picked', { carried: p.carried });
    } else i++;
  }

  // interact: deposit into nearest unlit lantern in range
  if (rise('interact') && p.carried > 0) {
    let best: Lantern | undefined;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      const d = distXZ(p.pos, l.pos);
      if (!l.lit && d <= T.interact_radius && d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        best.deposited += amount;
        p.carried -= amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        w.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // pulse: costs light, stuns + pushes shades in radius
  const stunnedNow = new Set<Shade>();
  if (rise('pulse') && p.pulseCdTicks === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCdTicks = secToTicks(T.pulse_cooldown_s);
    const stunned: string[] = [];
    for (const s of w.shades) {
      const d = distXZ(p.pos, s.pos);
      if (d > T.pulse_radius) continue;
      const [ux, uz] = d > 1e-9 ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [1, 0];
      s.pos[0] += ux * T.pulse_push_m;
      s.pos[2] += uz * T.pulse_push_m;
      clampToIsland(s.pos);
      enforceSafeZones(s, w.lanterns);
      s.state = 'stunned';
      s.stunTicks = secToTicks(T.pulse_stun_s);
      stunnedNow.add(s);
      stunned.push(s.id);
      w.score += T.score.per_stun;
    }
    emit('pulse', { stunned_ids: stunned });
  }

  // shades
  for (const s of w.shades) {
    if (s.state === 'stunned') {
      // a shade stunned this step keeps the full pulse_stun_s (no decrement on the pulse tick)
      if (!stunnedNow.has(s) && --s.stunTicks <= 0) { s.state = 'chase'; s.stunTicks = 0; }
      continue;
    }
    const d = distXZ(s.pos, p.pos);
    if (d > 1e-9) {
      const stepLen = Math.min(T.shade_speed / WORLD.tickRate, d);
      s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
      s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
    }
    enforceSafeZones(s, w.lanterns);
  }

  // hits
  if (p.invulnTicks === 0) {
    for (const s of w.shades) {
      if (s.state === 'stunned' || distXZ(s.pos, p.pos) > T.shade_hit_radius) continue;
      p.flames--;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invulnTicks = secToTicks(T.invuln_s);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }

  // spawns (disabled when the scenario turns randomness off)
  if (w.randomMotes) while (w.motes.length < WORLD.minActiveMotes) spawnMote(w);
  if (w.randomShades) {
    w.shadeSpawnTicks++;
    if (w.shadeSpawnTicks >= secToTicks(WORLD.shadeSpawnEveryS)) {
      w.shadeSpawnTicks = 0;
      if (w.shades.length < WORLD.maxShades) emit('shade_spawned', { id: spawnShade(w).id });
    }
  }

  w.tick = tick;
  w.prevButtons = { jump: input.jump, interact: input.interact, pulse: input.pulse };

  // game over
  if (w.lanterns.every((l) => l.lit)) {
    w.score += T.score.per_second_left * Math.floor(Math.max(0, timeLeftS(w)) + 1e-9)
      + T.score.per_flame_left * p.flames;
    w.state = 'won';
    emit('game_over', { result: 'won', reason: 'all_lit' });
  } else if (p.flames <= 0) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (timeLeftS(w) <= 1e-9) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}
