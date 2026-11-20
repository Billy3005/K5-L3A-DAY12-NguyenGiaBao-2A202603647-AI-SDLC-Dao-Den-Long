import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../src/io/run';
import { main } from '../src/headless';
import { TUNING } from '../src/sim/tuning';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const tmp = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body)); return p; };

describe('game.contract.json v1.1', () => {
  it('tuning matches the numbers the game uses', () => {
    const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
    expect(c.contract_version).toBe('1.1');
    expect(c.tuning).toEqual(TUNING);
  });
});

describe('output format v1.1', () => {
  for (const night of [1, 2, 3] as const) {
    it(`night ${night}: night_start at tick 0, snapshots every N, single end line, required fields`, () => {
      const lines = runHeadless({ seed: 42, night, ticks: 600, snapshotEvery: 10 }).map((l) => JSON.parse(l));
      expect(lines[0]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night } });
      const snaps = lines.filter((x) => x.type === 'snapshot');
      expect(snaps[0].tick).toBe(0);
      expect(snaps.every((s) => s.tick % 10 === 0)).toBe(true);
      expect(lines.at(-1).type).toBe('end');
      expect(lines.filter((x) => x.type === 'end')).toHaveLength(1);
      const s = snaps[0];
      expect(Object.keys(s)).toEqual(expect.arrayContaining(['type', 'tick', 'sim_tick', 'state', 'night', 'time_left_s', 'score',
        'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']));
      expect(s.night).toBe(night);
      expect(Object.keys(s.player)).toEqual(expect.arrayContaining(['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']));
      expect(s.player.pos).toEqual([0, 0, 0]);
      expect(s.time_left_s).toBe([300, 330, 360][night - 1]);
      expect(s.lanterns).toHaveLength([5, 6, 7][night - 1]);
      expect(s.charms).toHaveLength([0, 1, 2][night - 1]);
      const shadeStates = new Set(snaps.flatMap((x) => x.shades.map((y: { state: string }) => y.state)));
      for (const st of shadeStates) expect(['spawning', 'wander', 'chase', 'recoil', 'stunned']).toContain(st);
      expect(/\d\.\d{4,}/.test(JSON.stringify(lines))).toBe(false);
    });
  }
});

describe('determinism', () => {
  it('same seed + inputs -> identical output; different seed -> different', () => {
    const inputs = { frames: [{ tick: 0, move: [0.3, 1] as [number, number] }, { tick: 300, pulse: true }, { tick: 400, dash: true },
      { tick: 600, move: [-1, 0] as [number, number], cam_yaw_deg: 45 }, { tick: 900, pause: true }, { tick: 950, pause: false }, { tick: 960, pause: true }] };
    for (const night of [1, 2, 3] as const) {
      const a = runHeadless({ seed: 7, night, ticks: 3000, inputs }).join('\n');
      expect(runHeadless({ seed: 7, night, ticks: 3000, inputs }).join('\n')).toBe(a);
      expect(runHeadless({ seed: 8, night, ticks: 3000, inputs }).join('\n')).not.toBe(a);
    }
  });
});

describe('performance', () => {
  it('a full night (21,600 ticks) runs well under 30 s', () => {
    const t0 = performance.now();
    runHeadless({ seed: 1, night: 3, ticks: 21600, snapshotEvery: 10, scenario: { time_left_s: 360 } });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(30000);
  });
});

describe('CLI exit codes', () => {
  const out = join(dir, 'o.jsonl');
  const base = ['--seed', '1', '--night', '1', '--ticks', '10', '--out', out];
  it('0 on success for nights 1..3', () => {
    for (const n of ['1', '2', '3']) expect(main(['--seed', '1', '--night', n, '--ticks', '10', '--out', out])).toBe(0);
  });
  it('2 on malformed inputs / scenario', () => {
    expect(main([...base, '--inputs', tmp('bad.json', '{nope')])).toBe(2);
    expect(main([...base, '--inputs', tmp('dec.json', { frames: [{ tick: 5 }, { tick: 5 }] })])).toBe(2);
    expect(main([...base, '--inputs', tmp('rng.json', { frames: [{ tick: 0, move: [2, 0] }] })])).toBe(2);
    expect(main([...base, '--inputs', tmp('dash.json', { frames: [{ tick: 0, dash: 1 }] })])).toBe(2);
    expect(main([...base, '--scenario', tmp('sc.json', { lanterns: [{ id: 'L9' }] })])).toBe(2);
    expect(main([...base, '--scenario', tmp('sc2.json', { motes: [[1, 2]] })])).toBe(2);
    expect(main([...base, '--scenario', tmp('sc3.json', { shades: [{ pos: [1, 0, 1], state: 'angry' }] })])).toBe(2);
  });
  it('non-zero on bad args', () => {
    expect(main(['--seed', 'x', '--night', '1', '--ticks', '10', '--out', out])).not.toBe(0);
    expect(main(['--seed', '1', '--night', '4', '--ticks', '10', '--out', out])).not.toBe(0);
  });
});
