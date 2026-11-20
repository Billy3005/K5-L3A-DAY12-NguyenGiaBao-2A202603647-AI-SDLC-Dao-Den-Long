// Rules per Ticket-02 standard numbers (Contract v1.1). Phase-1 rule tests were replaced because
// Ticket-02 replaced every Phase-1 number (see docs/notes/phase-2.md); the old file lives at tag phase-1.
import { describe, expect, it } from 'vitest';
import { runHeadless, type RunOptions } from '../src/io/run';
import { createWorld, type Scenario } from '../src/sim/world';
import { distXZ, moveDir, step } from '../src/sim/step';
import { neutralInput, type InputState, type Vec3 } from '../src/sim/types';
import { TUNING as T } from '../src/sim/tuning';

const quiet = (extra: Scenario = {}): Scenario => ({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [], ...extra,
});
type Line = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (o: RunOptions): Line[] => runHeadless({ snapshotEvery: 1, ...o }).map((l) => JSON.parse(l));
const evs = (lines: Line[], name: string) => lines.filter((x) => x.type === 'event' && x.name === name);
const snapAt = (lines: Line[], tick: number) => lines.find((x) => x.type === 'snapshot' && x.tick === tick)!;
const end = (lines: Line[]) => lines.at(-1)!;
const inp = (o: Partial<InputState> = {}): InputState => ({ ...neutralInput(), ...o });
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);

describe('movement (run / jump / dash)', () => {
  it('runs 6.0 m/s with instant accel, contract yaw rotation', () => {
    const w = createWorld(1, 1, quiet());
    for (let i = 0; i < 60; i++) step(w, inp({ move: [0, 1] }));
    near(w.player.pos[2], 6);
    expect(w.player.vel).toEqual([0, 0, 6]);
    const [x, z] = moveDir([0, 1], 90); near(x, 1); near(z, 0);
  });
  it('jumps only when grounded with vy 7 and lands again', () => {
    const w = createWorld(1, 1, quiet());
    step(w, inp({ jump: true }));
    expect(w.player.grounded).toBe(false);
    near(w.player.vel[1], 7 - 20 / 60);
    for (let i = 0; i < 60; i++) step(w, inp({ jump: true })); // held: no re-jump
    expect(w.player.grounded).toBe(true);
    expect(w.player.pos[1]).toBe(0);
  });
  it('dash: 14 m/s for 12 ticks along facing (+Z) when idle, cooldown 90 ticks from start', () => {
    const lines = run({ seed: 1, ticks: 100, scenario: quiet(), inputs: { frames: [
      { tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false },
      { tick: 90, dash: true },
    ] } });
    expect(evs(lines, 'dash').map((e) => e.tick)).toEqual([1, 91]);
    near(snapAt(lines, 12).player.pos[2], 14 * 12 / 60, 1e-3);
    near(snapAt(lines, 1).player.dash_cd_s, 1.5, 1e-3); // 90 ticks left right after dashing -> ready at tick 91
  });
  it('dash follows move direction; air dash keeps altitude', () => {
    const lines = run({ seed: 1, ticks: 30, scenario: quiet(), inputs: { frames: [
      { tick: 0, jump: true }, { tick: 5, move: [1, 0], dash: true },
    ] } });
    const y6 = snapAt(lines, 6).player.pos[1];
    expect(y6).toBeGreaterThan(0);
    for (let t = 7; t <= 17; t++) expect(snapAt(lines, t).player.pos[1]).toBe(y6);
    expect(snapAt(lines, 17).player.pos[0]).toBeGreaterThan(2.7);
  });
});

describe('falling off the island', () => {
  const fallScenario = (flames: number) => quiet({ player: { pos: [39.5, 0, 0], carried: 3, flames } });
  it('-1 flame, lose all motes (lost), wait 60 ticks, respawn at start with invuln', () => {
    const lines = run({ seed: 1, ticks: 200, scenario: fallScenario(3), inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] } });
    const falls = evs(lines, 'player_hit');
    expect(falls).toHaveLength(1);
    expect(falls[0].data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 3 });
    const t = falls[0].tick;
    expect(snapAt(lines, t + 59).player.pos[1]).toBeLessThan(-10);
    expect(snapAt(lines, t + 60).player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], invuln: true, carried: 0 });
  });
  it('last flame lost by falling -> lost immediately (no_flames)', () => {
    const lines = run({ seed: 1, ticks: 200, scenario: fallScenario(1), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
    expect(evs(lines, 'game_over')[0].data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('motes and lanterns', () => {
  it('auto pickup within 1.0 m XZ and 1.5 m height; no score on pickup', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ motes: [[0, 1.5, 1], [0, 2, -0.5]] }) });
    expect(evs(lines, 'mote_picked')).toHaveLength(1);
    expect(end(lines).score).toBe(0);
  });
  it('capacity 10', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 10 }, motes: [[0, 0, 0]] }) });
    expect(evs(lines, 'mote_picked')).toHaveLength(0);
  });
  it('deposit min(carried, missing), +10 per deposited mote, +100 on light', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
      inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(evs(lines, 'deposit')[0].data).toEqual({ lantern_id: 'L1', amount: 10, deposited: 10 });
    expect(evs(lines, 'lantern_lit')[0].data).toEqual({ lantern_id: 'L1' });
    expect(end(lines).score).toBe(200);
  });
  it('partial deposit remembers progress; equidistant lanterns -> smaller id', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 4 },
      lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0], deposited: 3 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(evs(lines, 'deposit')[0].data).toEqual({ lantern_id: 'L1', amount: 4, deposited: 7 });
    expect(evs(lines, 'lantern_lit')).toHaveLength(0);
  });
  it('default night 1: 20 motes on distinct standard points, +1 every 240 ticks up to free points (24)', () => {
    const lines = run({ seed: 5, ticks: 1300, snapshotEvery: 240, scenario: { random_shades: false } });
    const s0 = snapAt(lines, 0);
    expect(s0.motes_active).toBe(20);
    expect(new Set(s0.motes.map((m: Line) => m.pos.join())).size).toBe(20);
    expect(s0.motes.every((m: Line) => m.kind === 'random' && m.ttl_s === null)).toBe(true);
    expect([240, 480, 720, 960, 1200].map((t) => snapAt(lines, t).motes_active)).toEqual([21, 22, 23, 24, 24]);
  });
});

describe('pulse', () => {
  it('3D radius from feet+0.8, costs 3, stun 120 ticks, 4 m push over 15 ticks, +5 each', () => {
    const lines = run({ seed: 1, ticks: 125, scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [4, 1, 0] }, { id: 'S2', pos: [5, 0, 0] }] }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(evs(lines, 'pulse')[0]).toMatchObject({ tick: 1, data: { stunned_ids: ['S1'] } }); // S2: sqrt(25+0.64) > 5
    expect(snapAt(lines, 1).player.carried).toBe(0);
    expect(snapAt(lines, 1).score).toBe(5);
    near(snapAt(lines, 15).shades[0].pos[0], 8, 1e-3);
    // stunned on ticks 1..120 = 120 ticks
    expect(snapAt(lines, 120).shades[0].state).toBe('stunned');
    expect(snapAt(lines, 121).shades[0].state).not.toBe('stunned');
  });
  it('not enough light or on cooldown -> nothing', () => {
    expect(evs(run({ seed: 1, ticks: 2, scenario: quiet({ player: { carried: 2 } }), inputs: { frames: [{ tick: 0, pulse: true }] } }), 'pulse')).toHaveLength(0);
    const cd = run({ seed: 1, ticks: 200, scenario: quiet({ player: { carried: 9 } }), inputs: { frames: [
      { tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 100, pulse: true }, { tick: 101, pulse: false }, { tick: 180, pulse: true },
    ] } });
    expect(evs(cd, 'pulse').map((e) => e.tick)).toEqual([1, 181]);
  });
  it('re-pulse a stunned shade refreshes stun and scores again', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 5 }] }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(evs(lines, 'pulse')[0].data.stunned_ids).toEqual(['S1']);
    expect(end(lines).score).toBe(5);
  });
});

describe('shades', () => {
  it('detect at 12 m and chase at 4.0 m/s; beyond 12 m wander stays put', () => {
    const w = createWorld(1, 1, quiet({ shades: [{ id: 'S1', pos: [10, 1, 0] }, { id: 'S2', pos: [0, 1, -15] }] }));
    for (let i = 0; i < 60; i++) step(w, inp());
    near(w.shades[0].pos[0], 6);
    expect(w.shades[0].state).toBe('chase');
    expect(w.shades[1]).toMatchObject({ state: 'wander', pos: [0, 1, -15] });
  });
  it('hit: -1 flame, drop floor(carried/2) into 1.5-2.5 m ring (ttl 8 s), invuln, recoil 2 m in 60 ticks', () => {
    const lines = run({ seed: 1, ticks: 61, scenario: quiet({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
    expect(evs(lines, 'player_hit')).toEqual([{ type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } }]);
    const s1 = snapAt(lines, 1);
    expect(s1.player).toMatchObject({ carried: 3, invuln: true });
    expect(s1.motes).toHaveLength(2);
    for (const m of s1.motes) {
      expect(m).toMatchObject({ kind: 'dropped', ttl_s: 8 });
      const d = Math.hypot(m.pos[0], m.pos[2]);
      expect(d).toBeGreaterThanOrEqual(1.5 - 1e-3); expect(d).toBeLessThanOrEqual(2.5 + 1e-3);
    }
    expect(s1.shades[0].state).toBe('recoil');
    near(snapAt(lines, 60).shades[0].pos[0], 0.5 - 4 / 60 + 2, 1e-3);
  });
  it('touching an invulnerable Mây does nothing; spawning shades do not hit', () => {
    const inv = run({ seed: 1, ticks: 99, scenario: quiet({ player: { invuln_ticks: 100 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
    expect(evs(inv, 'player_hit')).toHaveLength(0);
    expect(end(inv).state).toBe('playing');
    const sp = run({ seed: 1, ticks: 59, scenario: quiet({ shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'spawning', state_ticks_left: 60 }] }) });
    expect(evs(sp, 'player_hit')).toHaveLength(0);
  });
  it('schedule night 1: 2 at tick 300, then 1 every 480 ticks, spawning state, >= 15 m from player', () => {
    const lines = run({ seed: 3, ticks: 800, snapshotEvery: 100, scenario: { random_motes: false } });
    expect(evs(lines, 'shade_spawned').map((e) => [e.tick, e.data.id])).toEqual([[300, 'S1'], [300, 'S2'], [780, 'S3']]);
    const s = snapAt(lines, 300);
    expect(s.shades.map((x: Line) => x.state)).toEqual(['spawning', 'spawning']);
    for (const x of s.shades) expect(Math.hypot(x.pos[0], x.pos[2])).toBeCloseTo(37, 3);
  });
  it('safe zone: shade inside a just-lit lantern is evicted to 6 m within 30 ticks and never hits', () => {
    const w = createWorld(1, 1, quiet({
      player: { pos: [0, 0, 23], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }],
      shades: [{ id: 'S1', pos: [0.5, 1, 23.4] }],
    }));
    step(w, inp({ interact: true }));
    expect(w.lanterns[0].lit).toBe(true);
    for (let i = 0; i < 29; i++) step(w, inp());
    for (let i = 0; i < 300; i++) {
      expect(distXZ(w.shades[0].pos, w.lanterns[0].pos)).toBeGreaterThanOrEqual(T.safe_radius - 1e-9);
      step(w, inp());
    }
    expect(w.player.flames).toBe(3);
  });
});

describe('Gió Lạc (drifters)', () => {
  it('idle -> chase when carrying >= 5 within 15 m; steals min(3, carried); flees 240 ticks then removed', () => {
    const lines = run({ seed: 1, night: 2, ticks: 260, snapshotEvery: 20, scenario: quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [3, 1, 0] }] }) });
    expect(evs(lines, 'drifter_steal')).toEqual([{ type: 'event', tick: 16, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 3 } }]);
    expect(snapAt(lines, 20).drifters[0]).toMatchObject({ state: 'flee', stolen: 3 });
    expect(snapAt(lines, 260).drifters[0].state).toBe('removed');
  });
  it('does not chase when carrying < 5', () => {
    const lines = run({ seed: 1, night: 2, ticks: 60, scenario: quiet({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [3, 1, 0] }] }) });
    expect(evs(lines, 'drifter_steal')).toHaveLength(0);
    expect(snapAt(lines, 60).drifters[0].state).toBe('idle');
  });
  it('pulse on chasing drifter -> flee without stealing', () => {
    const lines = run({ seed: 1, night: 2, ticks: 30, scenario: quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1, 0], state: 'chase' }] }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(evs(lines, 'pulse')[0].data.drifter_ids).toEqual(['D1']);
    expect(evs(lines, 'drifter_steal')).toHaveLength(0);
    expect(snapAt(lines, 30).drifters[0]).toMatchObject({ state: 'flee', stolen: 0 });
  });
  it('pulse on fleeing drifter with loot -> drops it as dropped motes, removed after 120 ticks', () => {
    const lines = run({ seed: 1, night: 2, ticks: 121, scenario: quiet({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [2, 1, 0], state: 'flee', stolen: 3 }] }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(evs(lines, 'drifter_drop')[0]).toMatchObject({ tick: 1, data: { drifter_id: 'D1', amount: 3 } });
    const s1 = snapAt(lines, 1);
    expect(s1.motes.filter((m: Line) => m.kind === 'dropped')).toHaveLength(3);
    expect(snapAt(lines, 120).drifters[0].state).toBe('flee');
    expect(snapAt(lines, 121).drifters[0].state).toBe('removed');
  });
});

describe('Bùa Gió (charms)', () => {
  it('pickup -> charm_picked, 7.2 m/s, respawns after 2700 ticks', () => {
    const lines = run({ seed: 1, night: 2, ticks: 61, scenario: quiet({ player: { pos: [35, 0, 0] }, charms: [{ id: 'C1' }] }),
      inputs: { frames: [{ tick: 1, move: [1, 0] }] } });
    expect(evs(lines, 'charm_picked')[0]).toMatchObject({ tick: 1, data: { charm_id: 'C1', charm_ticks: 600 } });
    near(snapAt(lines, 61).player.pos[0], 35 + 7.2, 1e-6);
    expect(snapAt(lines, 1).charms[0]).toMatchObject({ id: 'C1', available: false, respawn_s: 45 });
  });
  it('charm removes dash cooldown but a press during a dash is ignored', () => {
    const frames = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 12, dash: true }];
    const withCharm = run({ seed: 1, ticks: 20, scenario: quiet({ player: { charm_ticks: 600 } }), inputs: { frames } });
    expect(evs(withCharm, 'dash').map((e) => e.tick)).toEqual([1, 13]);
    const without = run({ seed: 1, ticks: 20, scenario: quiet(), inputs: { frames } });
    expect(evs(without, 'dash').map((e) => e.tick)).toEqual([1]);
  });
});

describe('maps: nights 2 and 3', () => {
  it('lantern sets L1..L6 / L1..L7 at standard positions', () => {
    expect(snapAt(run({ seed: 1, night: 2, ticks: 0 }), 0).lanterns.map((l: Line) => l.pos)).toEqual(
      [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
    expect(snapAt(run({ seed: 1, night: 3, ticks: 0 }), 0).lanterns.map((l: Line) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });
  it('night 2 jump pad launches to the other island and lands there', () => {
    const w = createWorld(1, 2, quiet({ player: { pos: [20, 0, 18] } }));
    step(w, inp());
    expect(w.player.vel[1]).toBeCloseTo(14, 6);
    for (let i = 0; i < 119; i++) step(w, inp());
    expect(w.player.grounded).toBe(true);
    expect(distXZ(w.player.pos, [70, 0, 0])).toBeLessThanOrEqual(28);
    expect(w.player.flames).toBe(3);
  });
  it('night 3: cliff edge blocks walking up; ramp at 30° leads to tier 1 (y=3)', () => {
    const cliff = createWorld(1, 3, quiet({ player: { pos: [0, 0, 10] } }));
    for (let i = 0; i < 60; i++) step(cliff, inp({ move: [0, 1] }));
    expect(cliff.player.pos[2]).toBeLessThan(12);
    expect(cliff.player.pos[1]).toBe(0);
    const u = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    const ramp = createWorld(1, 3, quiet({ player: { pos: [31 * u[0], 0, 31 * u[1]] } }));
    for (let i = 0; i < 150; i++) step(ramp, inp({ move: [-u[0], -u[1]] }));
    near(ramp.player.pos[1], 3);
    expect(ramp.player.grounded).toBe(true);
  });
  it('night 3 jump pad lands on tier 2 (y=6)', () => {
    const w = createWorld(1, 3, quiet({ player: { pos: [0, 3, 13] } }));
    for (let i = 0; i < 90; i++) step(w, inp());
    expect(w.player.grounded).toBe(true);
    near(w.player.pos[1], 6);
  });
  it('night 3 wind: gust at sim_tick 1800 for 300 ticks pushes the player 2 m/s', () => {
    const lines = run({ seed: 4, night: 3, ticks: 1860, snapshotEvery: 60, scenario: quiet({ wind_enabled: true, player: { pos: [0, 0, -30] } }) });
    expect(snapAt(lines, 1740).wind).toEqual({ active: false, dir_deg: null });
    const s = snapAt(lines, 1800);
    expect(s.wind.active).toBe(true);
    expect(typeof s.wind.dir_deg).toBe('number');
    const a = s.player.pos as Vec3, b = snapAt(lines, 1860).player.pos as Vec3;
    near(distXZ(a, b), 2, 1e-3);
  });
});

describe('pause', () => {
  it('freezes sim_tick, time and logic; tick still advances; paused/resumed events', () => {
    const lines = run({ seed: 1, ticks: 40, scenario: quiet({ shades: [{ id: 'S1', pos: [10, 1, 0] }] }), inputs: { frames: [
      { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false },
    ] } });
    expect(evs(lines, 'paused').map((e) => e.tick)).toEqual([11]);
    expect(evs(lines, 'resumed').map((e) => e.tick)).toEqual([21]);
    const p15 = snapAt(lines, 15);
    expect(p15).toMatchObject({ state: 'paused', sim_tick: 10 });
    expect(p15.shades[0].pos).toEqual(snapAt(lines, 11).shades[0].pos);
    expect(end(lines)).toMatchObject({ ticks: 40, state: 'playing' });
    expect(snapAt(lines, 40)).toMatchObject({ sim_tick: 30, time_left_s: 299.5 });
  });
});

describe('win / lose', () => {
  it('win bonus floor(seconds left) x2 + 50 x flames; win beats dawn on the last tick', () => {
    const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const sc = (t: number) => quiet({ player: { carried: 10 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 1] }], time_left_s: t });
    const a = run({ seed: 1, ticks: 5, scenario: sc(100), inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(end(a)).toEqual({ type: 'end', ticks: 1, state: 'won', score: 100 + 100 + 99 * 2 + 3 * 50 });
    const b = run({ seed: 1, ticks: 5, scenario: sc(1 / 60), inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(evs(b, 'game_over')[0].data).toEqual({ result: 'won', reason: 'all_lit' });
  });
  it('dawn when time runs out', () => {
    const lines = run({ seed: 1, ticks: 100, scenario: quiet({ time_left_s: 1 }) });
    expect(evs(lines, 'game_over')[0]).toMatchObject({ tick: 60, data: { result: 'lost', reason: 'dawn' } });
  });
});
