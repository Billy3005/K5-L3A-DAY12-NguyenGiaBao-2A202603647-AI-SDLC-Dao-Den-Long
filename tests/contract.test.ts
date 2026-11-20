import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../src/io/run';
import { main } from '../src/headless';
import { TUNING } from '../src/sim/tuning';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const tmp = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body)); return p; };

describe('game.contract.json', () => {
  it('tuning matches the numbers the game uses', () => {
    const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
    expect(c.contract_version).toBe('1.0');
    expect(c.tuning).toEqual(TUNING);
  });
});

describe('output format', () => {
  const lines = runHeadless({ seed: 42, ticks: 600, snapshotEvery: 10 }).map((l) => JSON.parse(l));
  it('snapshot at tick 0, every N ticks, end line last', () => {
    const snaps = lines.filter((x) => x.type === 'snapshot');
    expect(snaps[0].tick).toBe(0);
    expect(snaps.every((s) => s.tick % 10 === 0 && s.sim_tick === s.tick)).toBe(true);
    expect(lines.at(-1).type).toBe('end');
    expect(lines.filter((x) => x.type === 'end')).toHaveLength(1);
  });
  it('tick-0 snapshot has the contract fields and 5 lanterns L1..L5, player at origin', () => {
    const s = lines[0];
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']));
    expect(s.player).toEqual({ pos: [0, 0, 0], flames: TUNING.flames, carried: 0 });
    expect(s.lanterns.map((l: { id: string }) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(s.time_left_s).toBe(TUNING.night1_duration_s);
  });
  it('coordinates have at most 3 decimals', () => {
    const txt = JSON.stringify(lines);
    expect(/\d\.\d{4,}/.test(txt)).toBe(false);
  });
});

describe('determinism', () => {
  it('same seed + inputs -> identical output; different seed -> different', () => {
    const inputs = { frames: [{ tick: 0, move: [0.3, 1] as [number, number] }, { tick: 300, pulse: true }, { tick: 600, move: [-1, 0] as [number, number], cam_yaw_deg: 45 }] };
    const a = runHeadless({ seed: 7, ticks: 3000, inputs }).join('\n');
    const b = runHeadless({ seed: 7, ticks: 3000, inputs }).join('\n');
    const c = runHeadless({ seed: 8, ticks: 3000, inputs }).join('\n');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('CLI exit codes', () => {
  const out = join(dir, 'o.jsonl');
  it('0 on success', () => { expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out])).toBe(0); });
  it('2 on malformed inputs / scenario', () => {
    expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out, '--inputs', tmp('bad.json', '{nope')])).toBe(2);
    expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out, '--inputs', tmp('dec.json', { frames: [{ tick: 5 }, { tick: 5 }] })])).toBe(2);
    expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out, '--inputs', tmp('rng.json', { frames: [{ tick: 0, move: [2, 0] }] })])).toBe(2);
    expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out, '--scenario', tmp('sc.json', { lanterns: [{ id: 'L9' }] })])).toBe(2);
    expect(main(['--seed', '1', '--night', '1', '--ticks', '10', '--out', out, '--scenario', tmp('sc2.json', { motes: [[1, 2]] })])).toBe(2);
  });
  it('non-zero on bad args', () => {
    expect(main(['--seed', 'x', '--night', '1', '--ticks', '10', '--out', out])).not.toBe(0);
    expect(main(['--night', '1', '--ticks', '10', '--out', out])).not.toBe(0);
  });
});
