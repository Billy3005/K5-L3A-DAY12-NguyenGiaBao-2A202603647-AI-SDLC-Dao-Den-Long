// Ticket-03 "Đèn cạn dầu" (Contract v1.2). Expectations computed by hand from docs/tickets/ticket-03.md.
import { describe, expect, it } from 'vitest';
import { runHeadless, type RunOptions } from '../src/io/run';
import { createWorld, type Scenario } from '../src/sim/world';
import { distXZ, step } from '../src/sim/step';
import { neutralInput, type InputState } from '../src/sim/types';

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
const interact0 = { frames: [{ tick: 0, interact: true }] };

describe('fuel', () => {
  it('scenario lit lantern defaults to fuel 100, ever_lit true; decays 1/s', () => {
    const lines = run({ seed: 1, ticks: 60, scenario: quiet({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 50 }] }) });
    expect(snapAt(lines, 0).lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true });
    expect(snapAt(lines, 60).lanterns[1].fuel).toBe(49);
  });
  it('fuel <= 0 -> lantern_out, unlit, deposited 0, fuel 0, ever_lit kept', () => {
    const lines = run({ seed: 1, ticks: 40, scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 0.5, deposited: 10 }] }) });
    expect(evs(lines, 'lantern_out')).toEqual([{ type: 'event', tick: 30, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
    expect(snapAt(lines, 30).lanterns[0]).toMatchObject({ lit: false, deposited: 0, fuel: 0, ever_lit: true });
  });
  it('relight costs 5 for ever_lit lanterns: relight:true, +5/mote +40, relit_count 1', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] }), inputs: interact0 });
    expect(evs(lines, 'deposit')[0].data).toEqual({ lantern_id: 'L1', amount: 5, deposited: 5 });
    expect(evs(lines, 'lantern_lit')[0].data).toEqual({ lantern_id: 'L1', relight: true });
    expect(end(lines).score).toBe(5 * 5 + 40);
    expect(snapAt(lines, 1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, relit_count: 1 });
  });
  it('refuel: used = min(carried, ceil((100 - fuel)/10)), fuel capped at 100, +5 per mote', () => {
    // fuel 55 -> 54.983 after step-2 decay -> ceil(4.50) = 5 used -> 100
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] }), inputs: interact0 });
    expect(evs(lines, 'refuel')).toEqual([{ type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 5, fuel: 100 } }]);
    expect(snapAt(lines, 1).player.carried).toBe(5);
    expect(end(lines).score).toBe(25);
  });
  it('capacity = 10 + 2 x successful_lights, max 20', () => {
    expect(snapAt(run({ seed: 1, ticks: 0, scenario: quiet({ player: { successful_lights: 3 } }) }), 0).player.capacity).toBe(16);
    expect(snapAt(run({ seed: 1, ticks: 0, scenario: quiet({ player: { successful_lights: 9 } }) }), 0).player.capacity).toBe(20);
    const picks = run({ seed: 1, ticks: 1, scenario: quiet({ player: { carried: 11, successful_lights: 1 }, motes: [[0, 0, 0], [0, 0, 0.5]] }) });
    expect(evs(picks, 'mote_picked')).toHaveLength(1); // capacity 12
  });
});

describe('shades drain weak lanterns', () => {
  // shade starts 4.9 m from L1 (not exactly 5: avoid a float boundary at exactly 2 m)
  const weakScene = () => quiet({ player: { pos: [0, 0, -20] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [0, 1, 20.1] }] });
  it('wander walks to the weak lantern, drains within 2 m, fuel_drain every 60 drain ticks', () => {
    const lines = run({ seed: 1, ticks: 110, scenario: weakScene() });
    expect(snapAt(lines, 43).shades[0].state).toBe('wander'); // 4.9 - 43*4/60 = 2.03
    expect(snapAt(lines, 44).shades[0].state).toBe('drain'); // 1.97
    // tick 104: 25 - 104/60 (decay) - 60*5/60 (drain) = 18.27 -> 18.3
    expect(evs(lines, 'fuel_drain')).toEqual([{ type: 'event', tick: 104, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 18.3 } }]);
  });
  it('weak lantern (< 30) has no safe zone; exactly 30 keeps it', () => {
    const w = createWorld(1, 1, weakScene());
    for (let i = 0; i < 50; i++) step(w, inp());
    expect(distXZ(w.shades[0].pos, w.lanterns[0].pos)).toBeLessThanOrEqual(2);
    const ok = createWorld(1, 1, quiet({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 100 }], shades: [{ id: 'S1', pos: [0, 1, 20] }] }));
    for (let i = 0; i < 60; i++) { step(ok, inp()); expect(distXZ(ok.shades[0].pos, ok.lanterns[0].pos)).toBeGreaterThanOrEqual(6 - 1e-9); }
  });
  it('drain -> chase when Mây within 6 m', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { pos: [0, 0, 20.5] }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 26], state: 'drain', target_lantern_id: 'L1' }] }) });
    expect(snapAt(lines, 1).shades[0].state).toBe('chase');
  });
  it('pulse on a draining shade scores 15 total', () => {
    const lines = run({ seed: 1, ticks: 1, scenario: quiet({ player: { pos: [0, 0, 23], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 26], state: 'drain', target_lantern_id: 'L1' }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
    expect(evs(lines, 'pulse')[0].data.stunned_ids).toEqual(['S1']);
    expect(end(lines).score).toBe(15);
  });
  it('refuel to >= 30 evicts shades in the zone in exactly 30 ticks, no damage', () => {
    const lines = run({ seed: 1, ticks: 60, scenario: quiet({ player: { pos: [0, 0, 26.5], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }] }), inputs: interact0 });
    expect(evs(lines, 'refuel')[0].data).toEqual({ lantern_id: 'L1', amount: 9, fuel: 100 });
    const d = (t: number) => distXZ(snapAt(lines, t).shades[0].pos, [0, 0, 25]);
    expect(d(29)).toBeLessThan(6);
    expect(d(30)).toBeGreaterThan(6);
    expect(evs(lines, 'player_hit')).toHaveLength(0);
  });
});

describe('dawn win rule', () => {
  const lamps = (n: number, fuel = 50) => ['L1', 'L2', 'L3', 'L4', 'L5'].slice(0, n).map((id) => ({ id, lit: true, fuel }));
  it('alive at dawn with >= ceil(0.6 N) lit -> won dawn_survived; score Σ(50+floor(fuel)) + 50 x flames', () => {
    const lines = run({ seed: 1, ticks: 100, scenario: quiet({ lanterns: lamps(3), time_left_s: 1 }) });
    expect(evs(lines, 'game_over')[0]).toMatchObject({ tick: 60, data: { result: 'won', reason: 'dawn_survived' } });
    expect(end(lines)).toEqual({ type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 49) + 3 * 50 });
  });
  it('below threshold at dawn -> lost dawn, no bonus', () => {
    const lines = run({ seed: 1, ticks: 100, scenario: quiet({ lanterns: lamps(2), time_left_s: 1 }) });
    expect(evs(lines, 'game_over')[0].data).toEqual({ result: 'lost', reason: 'dawn' });
    expect(end(lines).score).toBe(0);
  });
  it('all lanterns lit does not end the night early', () => {
    const lines = run({ seed: 1, ticks: 120, scenario: quiet({ lanterns: lamps(5) }) });
    expect(evs(lines, 'game_over')).toHaveLength(0);
    expect(end(lines).state).toBe('playing');
  });
  it('losing the last flame on the dawn tick -> no_flames first', () => {
    const lines = run({ seed: 1, ticks: 5, scenario: quiet({ player: { flames: 1 }, lanterns: lamps(3), time_left_s: 1 / 60, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
    expect(evs(lines, 'game_over')[0]).toMatchObject({ tick: 1, data: { result: 'lost', reason: 'no_flames' } });
  });
});
