// Ticket-04 §2 soak: N nights in one process, nights 1->2->3 rotating, night i (0-based) uses seed base+i.
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { MAPS } from '../sim/maps';
import { neutralInput, type World } from '../sim/types';

/** Separate input RNG (mulberry32) so the world's own RNG stream is untouched (decision D7). */
function inputRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play one night with random inputs until game_over or the standard duration. */
export function playRandomNight(w: World, seed: number): number {
  const r = inputRng(seed), inp = neutralInput();
  const maxTicks = MAPS[w.night].durationS * 60;
  while (w.state === 'playing' && w.simTick < maxTicks) {
    if (w.simTick % 30 === 0) {
      const a = r() * Math.PI * 2;
      inp.move = [Math.round(Math.cos(a) * 1000) / 1000, Math.round(Math.sin(a) * 1000) / 1000];
    }
    inp.jump = r() < 0.05; inp.dash = r() < 0.03; inp.pulse = r() < 0.02; inp.interact = r() < 0.1;
    step(w, inp);
  }
  return w.simTick;
}

export interface SoakResult {
  nights: number; crashes: number; results: string[];
  nightsPlayed: number[]; seeds: number[]; ticks: number[];
}

export function runSoak(baseSeed: number, nights: number, afterFirstLoad?: () => void): SoakResult {
  const out: SoakResult = { nights, crashes: 0, results: [], nightsPlayed: [], seeds: [], ticks: [] };
  for (let i = 0; i < nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3, seed = baseSeed + i;
    out.nightsPlayed.push(night); out.seeds.push(seed);
    try {
      let w: World | null = createWorld(seed, night);
      if (i === 0) afterFirstLoad?.();
      out.ticks.push(playRandomNight(w, seed));
      out.results.push(w.state === 'won' ? 'won' : 'lost');
      w = null; // reset: drop the night before loading the next
    } catch {
      out.crashes++; out.results.push('crashed'); out.ticks.push(-1);
    }
  }
  return out;
}
