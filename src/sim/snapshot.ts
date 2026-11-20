import { capacityOf, timeLeftS } from './step';
import { C } from './tuning';
import type { Vec3, World } from './types';

export const r3 = (x: number) => { const v = Math.round(x * 1000) / 1000; return v === 0 ? 0 : v; };
const v3 = (p: Vec3): Vec3 => [r3(p[0]), r3(p[1]), r3(p[2])];
const sec = (ticks: number) => r3(ticks / C.tickRate);

export function snapshot(w: World) {
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    state: w.paused && w.state === 'playing' ? 'paused' : w.state,
    night: w.night,
    time_left_s: r3(Math.max(0, timeLeftS(w))),
    score: w.score,
    wind: { active: w.wind.ticks > 0, dir_deg: w.wind.ticks > 0 ? w.wind.dirDeg : null },
    player: {
      pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, invuln: p.invulnTicks > 0,
      dash_cd_s: sec(p.dashCdTicks), pulse_cd_s: sec(p.pulseCdTicks), charm_s: sec(p.charmTicks),
      flames: p.flames, carried: p.carried, capacity: capacityOf(w),
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? Math.round((l.fuel / C.fuelUnit) * 10) / 10 : 0, ever_lit: l.everLit, relit_count: l.relitCount,
    })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : sec(m.ttl) })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: sec(c.respawnTicks) })),
  };
}
