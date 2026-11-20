// Ticket-04 (Contract v1.3): bench scene, frame stats, soak, leaderboard.
import { describe, expect, it } from 'vitest';
import { BENCH, benchCamera, createBenchWorld, frameStats } from '../src/sim/bench';
import { step } from '../src/sim/step';
import { neutralInput } from '../src/sim/types';
import { runSoak } from '../src/io/soak';
import { insertEntry, isoLocal, sortEntries, validateName, type Entry } from '../src/leaderboard';

describe('bench scene §1', () => {
  it('Night 1, 200 wander shades, 100 motes, L1-L3 lit at 100, Mây at origin', () => {
    const w = createBenchWorld(42);
    expect(w.night).toBe(1);
    expect(w.shades).toHaveLength(BENCH.shades);
    expect(w.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(w.motes).toHaveLength(BENCH.motes);
    expect(w.lanterns.filter((l) => l.lit).map((l) => [l.id, l.fuel])).toEqual([['L1', 6000], ['L2', 6000], ['L3', 6000]]);
    expect(w.player.pos).toEqual([0, 0, 0]);
    expect(Math.max(...w.shades.map((s) => Math.hypot(s.pos[0], s.pos[2])))).toBeLessThanOrEqual(BENCH.islandR);
  });
  it('spread evenly: every quadrant holds 50 ± 15 of the 200 shades', () => {
    const w = createBenchWorld(42);
    const q = [0, 0, 0, 0];
    for (const s of w.shades) q[(s.pos[0] >= 0 ? 0 : 1) + (s.pos[2] >= 0 ? 0 : 2)]++;
    for (const c of q) expect(Math.abs(c - 50)).toBeLessThanOrEqual(15);
  });
  it('deterministic for the same seed', () => {
    expect(createBenchWorld(42).shades.map((s) => s.pos)).toEqual(createBenchWorld(42).shades.map((s) => s.pos));
  });
  it('1 min of sim: shades move, nothing spawns/hits/picks up, fuel constant, night never ends', () => {
    const w = createBenchWorld(42);
    const before = w.shades.map((s) => [...s.pos]);
    const names = new Set<string>();
    for (let i = 0; i < 300 * 60; i++) for (const e of step(w, neutralInput())) names.add(e.name); // 300 s > night length 240 s
    expect(w.state).toBe('playing');
    for (const n of ['shade_spawned', 'mote_picked', 'player_hit', 'fuel_drain', 'lantern_out', 'game_over']) expect(names.has(n)).toBe(false);
    expect(w.shades).toHaveLength(200);
    expect(w.motes).toHaveLength(100);
    expect(w.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === 6000)).toBe(true);
    expect(w.player.flames).toBe(3);
    // Codex P4 review: shades near Mây must not switch to chase/drain — the ticket fixes 200 shades in wander
    expect(w.shades.filter((s) => s.state !== 'wander').map((s) => `${s.id}:${s.state}`)).toEqual([]);
    expect(w.shades.filter((s, i) => s.pos[0] !== before[i][0] || s.pos[2] !== before[i][2]).length).toBeGreaterThan(150);
  });
});

describe('frame stats §1 (ticket formulas)', () => {
  it('avg, 1% low, p95', () => {
    const dt = [...Array(99).fill(10), 50]; // N = 100, Σ = 1040
    const s = frameStats(dt);
    expect(s.frames).toBe(100);
    expect(s.avg_fps).toBeCloseTo(96.2, 1); // 1000*100/1040
    expect(s.p1_low_fps).toBe(20); // k = 1 -> 1000/50
    expect(s.frame_ms_p95).toBe(10);
  });
  it('k = ceil(0.01 N) worst frames', () => {
    const dt = [...Array(198).fill(10), 40, 20]; // N = 200 -> k = 2 -> mean 30
    expect(frameStats(dt).p1_low_fps).toBeCloseTo(33.3, 1);
  });
  it('camera starts at (30,15,0), quarter lap at 3.75 s is (0,15,-30) (CCW from above)', () => {
    expect(benchCamera(0)).toEqual([30, 15, -0]);
    const q = benchCamera(3750);
    expect(q[0]).toBeCloseTo(0, 6); expect(q[2]).toBeCloseTo(-30, 6);
    const full = benchCamera(15000);
    expect(full[0]).toBeCloseTo(30, 6); expect(full[2]).toBeCloseTo(0, 6);
  });
});

describe('soak §2', () => {
  it('3 nights rotate 1->2->3, deterministic results, no crash', () => {
    const a = runSoak(7, 3), b = runSoak(7, 3);
    expect(a.nights).toBe(3);
    expect(a.crashes).toBe(0);
    expect(a.results).toHaveLength(3);
    expect(a.results.every((r) => r === 'won' || r === 'lost')).toBe(true);
    expect(a.nightsPlayed).toEqual([1, 2, 3]);
    expect(a.seeds).toEqual([7, 8, 9]);
    expect(b.results).toEqual(a.results);
    expect(b.ticks).toEqual(a.ticks);
  }, 30000);
});

describe('leaderboard §3', () => {
  const e = (name: string, score: number, at: string): Entry => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });
  it('name 3-12 chars [A-Za-z0-9_] + Vietnamese letters', () => {
    expect(validateName('Bao_01')).toBe('Bao_01');
    expect(validateName('Mây')).toBe('Mây');
    expect(validateName('Nguyễn_Bảo')).toBe('Nguyễn_Bảo');
    expect(validateName('ab')).toBeNull();
    expect(validateName('abcdefghijklm')).toBeNull();
    expect(validateName('a b c')).toBeNull();
    expect(validateName('a-b-c')).toBeNull();
    expect(validateName('Ma\u0302y')).toBe('Mây'); // NFC
  });
  it('score desc, ties: earlier first, keep top 10', () => {
    let list: Entry[] = [];
    for (let i = 0; i < 12; i++) list = insertEntry(list, e(`P${i}x`, i * 10, `2026-11-20T10:${String(10 + i)}:00+07:00`));
    expect(list).toHaveLength(10);
    expect(list[0].score).toBe(110);
    expect(list.at(-1)!.score).toBe(20);
    list = insertEntry(list, e('Late', 110, '2026-11-20T11:00:00+07:00'));
    list = insertEntry(list, e('Early', 110, '2026-11-20T02:00:00Z')); // 09:00+07:00, before P11x
    expect(list.slice(0, 3).map((x) => x.name)).toEqual(['Early', 'P11x', 'Late']);
    expect(sortEntries([...list].reverse()).map((x) => x.name)).toEqual(list.map((x) => x.name));
  });
  it('achieved_at is ISO 8601 with a timezone offset', () => {
    expect(isoLocal(new Date('2026-11-20T09:30:05Z'))).toMatch(/^2026-11-20T\d\d:30:05[+-]\d\d:\d\d$/);
    expect(Date.parse(isoLocal(new Date('2026-11-20T09:30:05Z')))).toBe(Date.parse('2026-11-20T09:30:05Z'));
  });
});

describe('server static paths (Codex P4 review)', () => {
  it('malformed percent-encoding -> null (400) instead of throwing; traversal stays inside dist/web', async () => {
    const { staticPath } = await import('../src/server');
    expect(staticPath('/%E0%A4%A')).toBeNull();
    expect(staticPath('/../../package.json')).toMatch(/[\\/]web[\\/]package\.json$/);
    expect(staticPath('/')).toMatch(/[\\/]web[\\/]index\.html$/);
  });
});

describe('leaderboard export §3 (run_cmd --export-leaderboard)', () => {
  it('reads the board from disk, drops invalid rows, writes {"entries":[...]} in order', async () => {
    const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const d = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
    const board = join(d, 'leaderboard.json'), out = join(d, 'out.json');
    writeFileSync(board, JSON.stringify({ entries: [
      { name: 'Bao', score: 100, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 5 },
      { name: 'x', score: 999, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 5 }, // invalid name
      { name: 'Mây_2', score: 300, nights_won: 3, achieved_at: '2026-11-20T11:00:00+07:00', seed: 9 },
    ] }));
    process.env.LEADERBOARD_FILE = board;
    const { main } = await import('../src/server');
    expect(main(['--export-leaderboard', out])).toBe(0);
    const r = JSON.parse(readFileSync(out, 'utf8'));
    expect(r.entries.map((e: Entry) => e.name)).toEqual(['Mây_2', 'Bao']);
    delete process.env.LEADERBOARD_FILE;
  });
});
