import { timeLeftS } from './step';
import type { Vec3, World } from './types';

export const r3 = (x: number) => { const v = Math.round(x * 1000) / 1000; return v === 0 ? 0 : v; };
const v3 = (p: Vec3): Vec3 => [r3(p[0]), r3(p[1]), r3(p[2])];

export function snapshot(w: World) {
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.tick,
    state: w.state,
    time_left_s: r3(Math.max(0, timeLeftS(w))),
    score: w.score,
    player: { pos: v3(w.player.pos), flames: w.player.flames, carried: w.player.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}
