import { describe, expect, it } from 'vitest';
import { runHeadless } from '../src/io/run';
import { createWorld, type Scenario } from '../src/sim/world';
import { moveDir, step } from '../src/sim/step';
import { neutralInput, type InputState } from '../src/sim/types';
import { TUNING as T } from '../src/sim/tuning';

// Quiet scenario: no random entities, player alone at origin.
const quiet = (extra: Scenario = {}): Scenario => ({
  random_motes: false, random_shades: false, motes: [], shades: [], ...extra,
});
const parse = (lines: string[]) => lines.map((l) => JSON.parse(l));
const events = (lines: string[], name?: string) =>
  parse(lines).filter((x) => x.type === 'event' && (!name || x.name === name));
const inp = (o: Partial<InputState> = {}): InputState => ({ ...neutralInput(), ...o });

describe('movement', () => {
  it('moves player_speed m/s along +Z for 1s', () => {
    const w = createWorld(1, quiet());
    for (let i = 0; i < 60; i++) step(w, inp({ move: [0, 1] }));
    expect(w.player.pos[2]).toBeCloseTo(T.player_speed, 6);
    expect(w.player.pos[0]).toBeCloseTo(0, 9);
  });
  it('applies the contract yaw rotation and normalizes diagonals', () => {
    const [x, z] = moveDir([0, 1], 90);
    expect(x).toBeCloseTo(1, 9); expect(z).toBeCloseTo(0, 9);
    const [a, b] = moveDir([1, 1], 0);
    expect(Math.hypot(a, b)).toBeCloseTo(1, 9);
  });
  it('clamps the player inside the island (fall disabled)', () => {
    const w = createWorld(1, quiet());
    for (let i = 0; i < 60 * 20; i++) step(w, inp({ move: [1, 0] }));
    expect(Math.hypot(w.player.pos[0], w.player.pos[2])).toBeLessThanOrEqual(40 + 1e-9);
  });
});

describe('motes and lanterns', () => {
  it('picks up a mote within pickup_radius and scores per_mote', () => {
    const lines = runHeadless({ seed: 1, ticks: 1, scenario: quiet({ motes: [[0, 0, T.pickup_radius]] }) });
    expect(events(lines, 'mote_picked')).toEqual([{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    expect(parse(lines).at(-1)).toMatchObject({ type: 'end', score: T.score.per_mote });
  });
  it('does not pick up beyond carry_capacity', () => {
    const lines = runHeadless({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
    expect(events(lines, 'mote_picked')).toHaveLength(0);
  });
  it('deposits on interact rising edge and lights the lantern at lantern_cost', () => {
    const scenario = quiet({ player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }] });
    const lines = runHeadless({ seed: 1, ticks: 3, scenario, inputs: { frames: [{ tick: 1, interact: true }] } });
    expect(events(lines, 'deposit')[0]).toMatchObject({ tick: 2, data: { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost } });
    expect(events(lines, 'lantern_lit')[0]).toMatchObject({ tick: 2, data: { lantern_id: 'L1' } });
  });
  it('partial deposit only takes what is missing', () => {
    const scenario = quiet({ player: { carried: 4 }, lanterns: [{ id: 'L2', pos: [0, 0, 1], deposited: 3 }] });
    const lines = runHeadless({ seed: 1, ticks: 1, scenario, inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(lines, 'deposit')[0].data).toEqual({ lantern_id: 'L2', amount: 2, deposited: 5 });
    const snap = parse(lines).filter((x) => x.type === 'snapshot');
    expect(snap[0].player.carried).toBe(4);
  });
  it('holding interact does not re-trigger', () => {
    const scenario = quiet({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
    const lines = runHeadless({ seed: 1, ticks: 5, scenario, inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(lines, 'deposit')).toHaveLength(1);
  });
});

describe('pulse', () => {
  it('stuns and pushes shades in pulse_radius, costs pulse_cost, scores per_stun', () => {
    const scenario = quiet({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [T.pulse_radius, 0, 0] }, { id: 'S9', pos: [0, 0, 20] }] });
    const lines = runHeadless({ seed: 1, ticks: 1, snapshotEvery: 1, scenario, inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(events(lines, 'pulse')[0]).toMatchObject({ tick: 1, data: { stunned_ids: ['S1'] } });
    const s1 = parse(lines).filter((x) => x.type === 'snapshot')[1];
    expect(s1.player.carried).toBe(2 - T.pulse_cost);
    expect(s1.shades[0]).toMatchObject({ id: 'S1', state: 'stunned', pos: [T.pulse_radius + T.pulse_push_m, 0, 0] });
    expect(s1.score).toBe(T.score.per_stun);
  });
  it('respects cooldown and needs enough light', () => {
    const scenario = quiet({ player: { carried: 0 } });
    const lines = runHeadless({ seed: 1, ticks: 2, scenario, inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(events(lines, 'pulse')).toHaveLength(0);
    const cd = runHeadless({ seed: 1, ticks: 30, scenario: quiet({ player: { carried: 5 } }), inputs: { frames: [
      { tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 10, pulse: true },
    ] } });
    expect(events(cd, 'pulse')).toHaveLength(1);
  });
  it('stunned shade recovers to chase after pulse_stun_s', () => {
    const w = createWorld(1, quiet({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [3, 0, 0] }] }));
    step(w, inp({ pulse: true }));
    expect(w.shades[0].state).toBe('stunned');
    for (let i = 0; i < T.pulse_stun_s * 60; i++) step(w, inp());
    expect(w.shades[0].state).toBe('chase');
  });
});

describe('shades and hits', () => {
  it('shade chases at shade_speed', () => {
    const w = createWorld(1, quiet({ shades: [{ id: 'S1', pos: [20, 0, 0] }] }));
    for (let i = 0; i < 60; i++) step(w, inp());
    expect(w.shades[0].pos[0]).toBeCloseTo(20 - T.shade_speed, 6);
  });
  it('hit costs a flame, drops floor(carried*ratio), then invulnerable', () => {
    const scenario = quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [T.shade_hit_radius, 0, 0] }] });
    const lines = runHeadless({ seed: 1, ticks: Math.round(T.invuln_s * 60), scenario });
    const hits = events(lines, 'player_hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ tick: 1, data: { by: 'shade', flames: T.flames - 1, dropped: Math.floor(3 * T.hit_drop_ratio) } });
  });
  it('shade cannot enter safe_radius of a lit lantern', () => {
    const w = createWorld(1, quiet({
      player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], shades: [{ id: 'S1', pos: [0, 0, 10] }],
    }));
    for (let i = 0; i < 600; i++) {
      step(w, inp());
      expect(Math.hypot(w.shades[0].pos[0], w.shades[0].pos[2] - 25)).toBeGreaterThan(T.safe_radius);
    }
    expect(w.player.flames).toBe(T.flames);
  });
});

describe('game over', () => {
  it('wins when all lanterns lit, with time and flame bonus', () => {
    const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const scenario = quiet({ player: { carried: 5 }, lanterns: [...lanterns, { id: 'L5', pos: [0, 0, 1] }], time_left_s: 100 });
    const lines = runHeadless({ seed: 1, ticks: 100, scenario, inputs: { frames: [{ tick: 0, interact: true }] } });
    expect(events(lines, 'game_over')[0]).toMatchObject({ tick: 1, data: { result: 'won', reason: 'all_lit' } });
    // scenario-lit lanterns give no score; time left after 1 tick = 99.98 -> floor 99
    const expected = T.score.per_lantern + 99 * T.score.per_second_left + T.flames * T.score.per_flame_left;
    expect(parse(lines).at(-1)).toEqual({ type: 'end', ticks: 1, state: 'won', score: expected });
  });
  it('loses with no_flames', () => {
    const lines = runHeadless({ seed: 1, ticks: 10, scenario: quiet({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] }) });
    expect(events(lines, 'game_over')[0].data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
  it('loses at dawn when time runs out', () => {
    const lines = runHeadless({ seed: 1, ticks: 1000, scenario: quiet({ time_left_s: 1 }) });
    expect(events(lines, 'game_over')[0]).toMatchObject({ tick: 60, data: { result: 'lost', reason: 'dawn' } });
    expect(parse(lines).at(-1)).toMatchObject({ ticks: 60, state: 'lost' });
  });
});
