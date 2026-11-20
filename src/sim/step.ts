import { rand } from './rng';
import { C, TUNING as T } from './tuning';
import { freeMotePoint, idNum, mapOf, newDrifter, newShade, spawnRandomMote } from './world';
import type { Drifter, GameEvent, InputState, Lantern, Shade, Vec3, World } from './types';

export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const byId = <X extends { id: string }>(xs: X[]) => [...xs].sort((a, b) => idNum(a.id) - idNum(b.id));
const away = (from: Vec3, to: Vec3): [number, number] => {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return d > 1e-9 ? [dx / d, dz / d] : [1, 0]; // coincident -> +X
};

export function timeLeftS(w: World): number {
  return w.startTimeLeftS - w.simTick / C.tickRate;
}

/** Contract movement: rotate input [x,z] by cam yaw, normalize if longer than 1. */
export function moveDir(move: [number, number], camYawDeg: number): [number, number] {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  const th = (camYawDeg * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}

const targetable = (w: World) => w.player.fallWaitTicks === 0;
/** Ticket-03: only lit lanterns with fuel ≥ 30 keep a safe zone. */
const hasSafeZone = (l: Lantern) => l.lit && l.fuel >= C.lowFuelU;
const isWeak = (l: Lantern) => l.lit && l.fuel < C.lowFuelU;
export const capacityOf = (w: World) => Math.min(C.capacityMax, C.capacityBase + C.capacityPerLight * w.player.successfulLights);
const fuel1 = (units: number) => Math.round((units / C.fuelUnit) * 10) / 10;
/** Nearest lantern matching `ok` (ties: smaller id). */
function nearestLantern(w: World, from: Vec3, ok: (l: Lantern) => boolean): Lantern | undefined {
  let best: Lantern | undefined, bestD = Infinity;
  for (const l of byId(w.lanterns)) {
    if (!ok(l)) continue;
    const d = distXZ(from, l.pos);
    if (d < bestD) { best = l; bestD = d; }
  }
  return best;
}
/** Mark shades within the zone of `l` to be pushed out radially in exactly 30 ticks, harmless meanwhile. */
function evictFrom(w: World, l: Lantern): void {
  for (const s of w.shades) {
    const d = distXZ(s.pos, l.pos);
    if (d <= T.safe_radius) { // "within r" means ≤ r (contract)
      s.evictTicks = C.evictTicks; s.evictFrom = l.pos;
      s.evictStep = (T.safe_radius + 1e-3 - d) / C.evictTicks;
      if (s.state === 'drain') s.state = 'wander';
    }
  }
}

/** Lit lanterns block shades at the safe-zone edge (evicting shades are exempt). */
function clampOutsideSafe(s: Shade, lanterns: Lantern[]): boolean {
  let hit = false;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const l of lanterns) {
      if (!hasSafeZone(l)) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < T.safe_radius) {
        const [ux, uz] = away(l.pos, s.pos);
        s.pos[0] = l.pos[0] + ux * T.safe_radius;
        s.pos[2] = l.pos[2] + uz * T.safe_radius;
        moved = hit = true;
      }
    }
    if (!moved) break;
  }
  return hit;
}

function dropMotes(w: World, at: Vec3, n: number, ring: boolean): void {
  for (let i = 0; i < n; i++) {
    let x = at[0], z = at[2];
    if (ring) {
      const a = rand(w) * Math.PI * 2, r = C.dropRMin + rand(w) * (C.dropRMax - C.dropRMin);
      x += Math.cos(a) * r; z += Math.sin(a) * r;
    }
    // mote sits on the ground at that XZ; over void (or the tower) keep the dropper's ground height
    const top = mapOf(w).topAt(x, z);
    const fallbackY = ring ? at[1] : at[1] - C.shadeHoverY;
    const y = top === null || top > 6 ? fallbackY : top;
    w.motes.push({ id: `M${w.nextMoteId++}`, pos: [x, y, z], kind: 'dropped', ttl: C.dropTtl, point: null });
  }
}

/**
 * Advance one tick following Ticket-02's mandatory order. Events get tick = w.tick + 1.
 */
export function step(w: World, input: InputState): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.state !== 'playing') return events;
  const tick = w.tick + 1;
  const emit = (name: string, data: Record<string, unknown> = {}) => events.push({ type: 'event', tick, name, data });
  const rise = (k: keyof World['prevButtons']) => input[k] && !w.prevButtons[k];
  const p = w.player;
  const map = mapOf(w);
  const endTick = () => { w.prevButtons = { jump: input.jump, interact: input.interact, pulse: input.pulse, dash: input.dash, pause: input.pause }; w.tick = tick; };

  // 1. input: pause first
  if (rise('pause')) {
    w.paused = !w.paused;
    if (w.paused) { emit('paused'); endTick(); return events; }
    emit('resumed');
  } else if (w.paused) { endTick(); return events; }

  // 2. counters
  w.simTick++;
  if (p.pulseCdTicks > 0) p.pulseCdTicks--;
  if (p.dashCdTicks > 0) p.dashCdTicks--;
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.charmTicks > 0) p.charmTicks--;
  for (const s of w.shades) {
    if ((s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') && s.stateTicks > 0 && --s.stateTicks === 0) s.state = 'wander';
  }
  // (drifter flee timer and gust timer are not in the ticket's step-2 list: they count down after moving,
  //  so a 240-tick flee / 300-tick gust acts on exactly 240 / 300 movement ticks)
  w.motes = w.motes.filter((m) => m.ttl === null || --m.ttl > 0);
  for (const c of w.charms) if (!c.available && c.respawnTicks > 0 && --c.respawnTicks === 0) c.available = true;
  // Ticket-03: fuel decay (1/s) + drain (5/s per draining shade), integer 1/60 units
  for (const l of w.lanterns) if (l.lit) l.fuel -= C.decayPerTickU;
  const drainEvents: [Lantern, Shade][] = [];
  for (const s of byId(w.shades)) {
    if (s.state !== 'drain') continue;
    const l = w.lanterns.find((x) => x.id === s.target);
    if (!l || !l.lit) continue;
    l.fuel -= C.drainPerTickU;
    if (++s.drainTicks % C.fuelDrainEventEvery === 0) drainEvents.push([l, s]);
  }
  for (const [l, s] of drainEvents) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: fuel1(Math.max(0, l.fuel)) });
  // right after step 2: lanterns out of fuel go dark
  for (const l of byId(w.lanterns)) {
    if (l.lit && l.fuel <= 0) {
      l.lit = false; l.fuel = 0; l.deposited = 0; l.everLit = true;
      emit('lantern_out', { lantern_id: l.id });
    }
  }

  // 3. move player (jump, dash, pads, wind), then fall check
  if (p.fallWaitTicks > 0) {
    if (--p.fallWaitTicks === 0) {
      p.pos = [...map.start] as Vec3; p.vel = [0, 0, 0]; p.grounded = true; p.launch = null;
      p.dashTicks = 0; p.invulnTicks = C.invulnTicks; p.facing = [0, 1];
    }
  } else {
    movePlayer(w, input, rise('jump'), rise('dash'), emit);
    if (p.pos[1] < C.fallY) {
      const lost = p.carried;
      p.flames--; p.carried = 0; p.vel = [0, 0, 0];
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
      if (p.flames > 0) p.fallWaitTicks = C.fallWaitTicks;
    }
  }
  if (w.wind.ticks > 0 && --w.wind.ticks === 0) w.wind.dirDeg = null;

  // 4. pickups (motes, charms)
  if (targetable(w) && p.flames > 0) {
    for (let i = 0; i < w.motes.length && p.carried < capacityOf(w);) {
      const m = w.motes[i];
      if (distXZ(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= C.pickupHeight) {
        w.motes.splice(i, 1);
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of w.charms) {
      if (c.available && distXZ(p.pos, c.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= C.pickupHeight) {
        c.available = false; c.respawnTicks = C.charmRespawnTicks; p.charmTicks = C.charmTicks;
        emit('charm_picked', { charm_id: c.id, charm_ticks: C.charmTicks });
      }
    }
  }

  // 5. interact: nearest lantern that can accept motes (unlit, or lit but not full); ties -> smaller id
  const zoneGained: Lantern[] = [];
  if (rise('interact') && targetable(w) && p.carried > 0) {
    const best = nearestLantern(w, p.pos, (l) => (!l.lit || l.fuel < C.fuelMaxU) && distXZ(p.pos, l.pos) <= T.interact_radius);
    if (best && !best.lit) {
      const cost = best.everLit ? C.relightCost : C.firstLightCost;
      const amount = Math.max(0, Math.min(p.carried, cost - best.deposited));
      if (amount > 0) {
        best.deposited += amount; p.carried -= amount;
        w.score += amount * T.score.per_mote;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.fuel = C.fuelMaxU; best.everLit = true;
        if (relight) { best.relitCount++; w.score += C.scoreRelight; } else w.score += T.score.per_lantern;
        p.successfulLights++;
        zoneGained.push(best);
        emit('lantern_lit', { lantern_id: best.id, relight });
      }
    } else if (best) {
      // refuel: used = min(carried, ceil((100 - fuel) / 10))
      const used = Math.min(p.carried, Math.ceil((C.fuelMaxU - best.fuel) / C.fuelPerMoteU));
      const before = best.fuel;
      best.fuel = Math.min(C.fuelMaxU, best.fuel + C.fuelPerMoteU * used);
      p.carried -= used;
      w.score += used * T.score.per_mote;
      emit('refuel', { lantern_id: best.id, amount: used, fuel: fuel1(best.fuel) });
      if (before < C.lowFuelU && best.fuel >= C.lowFuelU) zoneGained.push(best);
    }
  }

  // 6. safe zones: a lantern that just (re)gained its zone pushes shades inside out in exactly 30 ticks
  for (const l of zoneGained) evictFrom(w, l);

  // 7. pulse
  if (rise('pulse') && targetable(w) && p.pulseCdTicks === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCdTicks = C.pulseCdTicks;
    const center: Vec3 = [p.pos[0], p.pos[1] + C.pulseCenterY, p.pos[2]];
    const stunned: string[] = [], drifterIds: string[] = [];
    for (const s of byId(w.shades)) {
      if (dist3(center, s.pos) > T.pulse_radius) continue;
      w.score += s.state === 'drain' ? C.scoreStunDrain : T.score.per_stun; // +15 total if it was draining
      s.state = 'stunned'; s.stateTicks = C.stunTicks; s.drainTicks = 0;
      s.pushTicks = C.pushTicks; s.pushDir = away(p.pos, s.pos);
      stunned.push(s.id);
    }
    for (const d of byId(w.drifters)) {
      if (d.state === 'removed' || dist3(center, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.stateTicks = C.drifterFleeTicks; d.fleeSetTick = w.simTick; drifterIds.push(d.id); }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen; d.stolen = 0;
        dropMotes(w, d.pos, amount, false);
        d.stateTicks = C.drifterDropFleeTicks; d.fleeSetTick = w.simTick;
        drifterIds.push(d.id);
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit('pulse', { stunned_ids: stunned, drifter_ids: drifterIds });
  }

  // 8. move shades and drifters
  const speed = map.shadeSpeed / C.tickRate;
  for (const s of w.shades) {
    if (s.state === 'drain') {
      const l = w.lanterns.find((x) => x.id === s.target);
      if (!l || !l.lit || l.fuel >= C.lowFuelU || distXZ(s.pos, l.pos) > C.drainEnterM) { s.state = 'wander'; s.drainTicks = 0; }
      else if (targetable(w) && distXZ(s.pos, p.pos) <= C.drainChaseM) { s.state = 'chase'; s.drainTicks = 0; }
    }
    if (s.evictTicks > 0 && s.evictFrom) {
      // exactly 30 ticks, radially, ending just outside 6 m
      const [ux, uz] = away(s.evictFrom, s.pos);
      s.pos[0] += ux * s.evictStep; s.pos[2] += uz * s.evictStep;
      if (--s.evictTicks === 0) s.evictFrom = null;
    } else if (s.state === 'drain') {
      // stands still and drains (fuel is subtracted in step 2)
    } else if (s.state === 'stunned') {
      if (s.pushTicks > 0) {
        s.pushTicks--;
        const nx = s.pos[0] + s.pushDir[0] * (T.pulse_push_m / C.pushTicks);
        const nz = s.pos[2] + s.pushDir[1] * (T.pulse_push_m / C.pushTicks);
        // obstacle = terrain rising above the shade's hover base (tier wall, bell tower): the push stops there
        const top = map.topAt(nx, nz);
        if (top !== null && top > s.pos[1] - C.shadeHoverY + C.stepUp) s.pushTicks = 0;
        else {
          s.pos[0] = nx; s.pos[2] = nz;
          if (clampOutsideSafe(s, w.lanterns)) s.pushTicks = 0; // safe-zone edge also stops the push
        }
      }
    } else if (s.state === 'recoil') {
      s.pos[0] += s.recoilDir[0] * (C.recoilM / C.recoilTicks);
      s.pos[2] += s.recoilDir[1] * (C.recoilM / C.recoilTicks);
      clampOutsideSafe(s, w.lanterns);
    } else if (s.state === 'wander' || s.state === 'chase') {
      const d = distXZ(s.pos, p.pos);
      if (s.state === 'wander' && targetable(w) && d <= C.detectM) s.state = 'chase';
      else if (s.state === 'chase' && (!targetable(w) || d > C.giveUpM)) s.state = 'wander';
      if (s.state === 'chase' && d > 1e-9) {
        const stepLen = Math.min(speed, d);
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
      } else if (s.state === 'wander') {
        // Ticket-03: go to the nearest weak lantern (lit, fuel < 30); else keep / pick the nearest unlit lantern
        const weak = nearestLantern(w, s.pos, isWeak);
        const cur = w.lanterns.find((l) => l.id === s.target);
        const tgt = weak ?? (cur && !cur.lit ? cur : nearestLantern(w, s.pos, (l) => !l.lit));
        s.target = tgt?.id ?? null;
        if (tgt) {
          const dl = distXZ(s.pos, tgt.pos);
          if (!(tgt === weak) && dl <= C.drainEnterM) { /* hover at an unlit lantern */ } else if (dl > 1e-9) {
            const stepLen = Math.min(speed, dl);
            s.pos[0] += ((tgt.pos[0] - s.pos[0]) / dl) * stepLen;
            s.pos[2] += ((tgt.pos[2] - s.pos[2]) / dl) * stepLen;
          }
          if (tgt === weak && distXZ(s.pos, tgt.pos) <= C.drainEnterM) { s.state = 'drain'; s.drainTicks = 0; }
        }
      }
      clampOutsideSafe(s, w.lanterns);
    }
    // y stays as spawned (ground + 1) or as given by the scenario: predictable 3D pulse/hit distances
  }
  for (const d of w.drifters) moveDrifter(w, d);

  // 9. contact: drifters steal first, then shades hit (ascending id)
  if (targetable(w) && p.flames > 0) {
    for (const d of byId(w.drifters)) {
      if (d.state !== 'chase' || distXZ(d.pos, p.pos) > C.drifterTouchM) continue;
      const amount = Math.min(C.drifterStealMax, p.carried);
      p.carried -= amount; d.stolen = amount;
      d.state = 'flee'; d.stateTicks = C.drifterFleeTicks; d.fleeSetTick = w.simTick;
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const s of byId(w.shades)) {
      if ((s.state !== 'wander' && s.state !== 'chase') || s.evictTicks > 0) continue;
      if (distXZ(s.pos, p.pos) > T.shade_hit_radius || Math.abs(s.pos[1] - p.pos[1]) > C.hitHeight) continue;
      if (p.invulnTicks > 0) continue; // touching an invulnerable Mây does nothing
      p.flames--;
      const dropped = Math.floor(p.carried / 2);
      p.carried -= dropped;
      dropMotes(w, p.pos, dropped, true);
      p.invulnTicks = C.invulnTicks;
      s.state = 'recoil'; s.stateTicks = C.recoilTicks; s.recoilDir = away(p.pos, s.pos);
      // first of 60 recoil steps happens on the hit tick, so the full 2 m is covered in 60 ticks
      s.pos[0] += s.recoilDir[0] * (C.recoilM / C.recoilTicks);
      s.pos[2] += s.recoilDir[1] * (C.recoilM / C.recoilTicks);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  // 10. scheduled spawns (new entities interact from the next tick)
  const t = w.simTick;
  if (w.randomMotes && t % C.moteEvery === 0 && w.motes.filter((m) => m.kind === 'random').length < C.moteCap) {
    const pt = freeMotePoint(w);
    if (pt >= 0) spawnRandomMote(w, pt);
  }
  if (w.randomShades && t >= C.shadeFirstTick && (t - C.shadeFirstTick) % map.shadeEvery === 0) {
    const n = t === C.shadeFirstTick ? 2 : 1;
    const taken = new Set<number>();
    for (let i = 0; i < n && w.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.map((_, k) => k).filter((k) => !taken.has(k) && distXZ(map.shadePoints[k], p.pos) >= 15);
      if (!valid.length) break;
      const k = valid[Math.floor(rand(w) * valid.length)];
      taken.add(k);
      const pt = map.shadePoints[k];
      const s = newShade(`S${w.nextShadeId++}`, [pt[0], pt[1] + C.shadeHoverY, pt[2]], 'spawning', C.spawningTicks);
      w.shades.push(s);
      emit('shade_spawned', { id: s.id });
    }
  }
  if (map.drifters && w.randomDrifters && t % C.drifterEvery === 0
    && w.drifters.filter((d) => d.state !== 'removed').length < C.drifterMax) {
    const pt = map.shadePoints[Math.floor(rand(w) * map.shadePoints.length)];
    w.drifters.push(newDrifter(`D${w.nextDrifterId++}`, [pt[0], pt[1] + C.shadeHoverY, pt[2]]));
  }
  if (map.wind && w.windEnabled && t % C.windEvery === 0) {
    w.wind = { ticks: C.windTicks, dirDeg: Math.floor(rand(w) * 360) };
  }

  // 11. win / lose
  endTick();
  // Ticket-03: no early win; at dawn win if alive and lit lanterns ≥ ceil(0.6 × N)
  if (p.flames <= 0) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (timeLeftS(w) <= 1e-9) {
    const lit = w.lanterns.filter((l) => l.lit);
    if (lit.length >= Math.ceil(C.winRatio * w.lanterns.length - 1e-9)) {
      for (const l of lit) w.score += C.scoreDawnLamp + Math.floor(l.fuel / C.fuelUnit);
      w.score += T.score.per_flame_left * p.flames;
      w.state = 'won';
      emit('game_over', { result: 'won', reason: 'dawn_survived' });
    } else {
      w.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
  }
  return events;
}

function moveDrifter(w: World, d: Drifter): void {
  const p = w.player;
  if (d.state === 'removed') return;
  const dist = distXZ(d.pos, p.pos);
  if (d.state === 'idle' && targetable(w) && p.carried >= C.drifterChaseCarry && dist <= C.drifterChaseM) d.state = 'chase';
  else if (d.state === 'chase' && (!targetable(w) || p.carried < C.drifterChaseCarry || dist > C.drifterChaseM)) {
    d.state = 'idle';
    d.home = [d.pos[0] - Math.cos(d.angle) * C.drifterIdleR, d.pos[2] - Math.sin(d.angle) * C.drifterIdleR];
  }
  const sp = C.drifterSpeed / C.tickRate;
  if (d.state === 'idle') {
    d.angle += C.drifterIdleSpeed / C.drifterIdleR / C.tickRate;
    d.pos[0] = d.home[0] + Math.cos(d.angle) * C.drifterIdleR;
    d.pos[2] = d.home[1] + Math.sin(d.angle) * C.drifterIdleR;
  } else if (d.state === 'chase' && dist > 1e-9) {
    const l = Math.min(sp, dist);
    d.pos[0] += ((p.pos[0] - d.pos[0]) / dist) * l;
    d.pos[2] += ((p.pos[2] - d.pos[2]) / dist) * l;
  } else if (d.state === 'flee') {
    const [ux, uz] = away(p.pos, d.pos);
    d.pos[0] += ux * sp; d.pos[2] += uz * sp;
    // count down after moving; the tick the flee was (re)set does not count
    if (d.fleeSetTick !== w.simTick && --d.stateTicks <= 0) { d.stateTicks = 0; d.state = 'removed'; }
  }
}

function movePlayer(w: World, input: InputState, jump: boolean, dash: boolean,
  emit: (n: string, d?: Record<string, unknown>) => void): void {
  const p = w.player;
  const map = mapOf(w);
  const [mx, mz] = moveDir(input.move, input.cam_yaw_deg);
  const moving = Math.hypot(mx, mz) > 1e-9;
  if (moving) { const l = Math.hypot(mx, mz); p.facing = [mx / l, mz / l]; }

  // dash: rising edge, not already dashing, cooldown ready (charm removes the cooldown)
  if (dash && p.dashTicks === 0 && (p.dashCdTicks === 0 || p.charmTicks > 0)) {
    p.dashTicks = C.dashTicks;
    p.dashDir = moving ? [mx / Math.hypot(mx, mz), mz / Math.hypot(mx, mz)] : [...p.facing];
    p.dashCdTicks = p.charmTicks > 0 ? 0 : C.dashCdTicks;
    emit('dash');
  }
  const dashing = p.dashTicks > 0;
  let vx: number, vz: number;
  if (dashing) {
    vx = p.dashDir[0] * T.dash_speed; vz = p.dashDir[1] * T.dash_speed;
  } else if (p.launch) {
    [vx, vz] = p.launch;
  } else {
    const sp = p.charmTicks > 0 ? C.charmSpeed : T.player_speed;
    vx = mx * sp; vz = mz * sp; // instant accel/stop (0 s ≤ 0.1 s)
  }
  if (w.wind.ticks > 0 && w.wind.dirDeg !== null) {
    const a = (w.wind.dirDeg * Math.PI) / 180;
    vx += Math.cos(a) * C.windSpeed; vz += Math.sin(a) * C.windSpeed;
  }
  let vy = p.vel[1];
  if (jump && p.grounded && !dashing) { vy = C.jumpSpeed; p.grounded = false; }
  if (dashing) vy = 0; // dash keeps altitude

  // horizontal move with walls (step-up tolerance); embedded players may walk out freely
  const y = p.pos[1];
  const blocked = (x: number, z: number) => {
    const cur = map.topAt(p.pos[0], p.pos[2]);
    const embedded = cur !== null && cur > y + C.stepUp;
    const top = map.topAt(x, z);
    return !embedded && top !== null && top > y + C.stepUp;
  };
  const nx = p.pos[0] + vx / C.tickRate, nz = p.pos[2] + vz / C.tickRate;
  if (!blocked(nx, nz)) { p.pos[0] = nx; p.pos[2] = nz; }
  else if (!blocked(nx, p.pos[2])) { p.pos[0] = nx; vz = 0; }
  else if (!blocked(p.pos[0], nz)) { p.pos[2] = nz; vx = 0; }
  else { vx = 0; vz = 0; }

  // vertical
  const top = map.topAt(p.pos[0], p.pos[2]);
  if (p.grounded && vy <= 0) {
    if (top === null || top < y - C.stepUp) { p.grounded = false; vy = 0; } // walked off a ledge / island
    else if (top <= y + C.stepUp) { p.pos[1] = top; vy = 0; } // follow ground/ramps
  }
  if (!p.grounded) {
    if (!dashing) vy -= C.gravity / C.tickRate;
    const ny = p.pos[1] + vy / C.tickRate;
    if (top !== null && vy <= 0 && ny <= top && p.pos[1] >= top - C.stepUp) {
      p.pos[1] = top; vy = 0; p.grounded = true; p.launch = null;
    } else p.pos[1] = ny;
  }
  // jump pads: feet on the pad
  if (p.grounded) {
    for (const pad of map.pads) {
      if (distXZ(p.pos, pad.pos) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) <= C.stepUp) {
        vy = pad.vy; p.grounded = false;
        p.launch = [pad.dir[0] * pad.h, pad.dir[1] * pad.h];
        break;
      }
    }
  }
  if (dashing) p.dashTicks--;
  p.vel = [vx, vy, vz];
}
