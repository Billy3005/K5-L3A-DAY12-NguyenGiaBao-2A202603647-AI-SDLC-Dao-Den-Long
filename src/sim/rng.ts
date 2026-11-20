import type { World } from './types';

// mulberry32: tiny deterministic PRNG; state lives in the world so runs are reproducible.
export function rand(w: World): number {
  w.rngState = (w.rngState + 0x6d2b79f5) | 0;
  let t = w.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform random point in an annulus [minR, maxR] on the XZ plane. */
export function randomInRing(w: World, minR: number, maxR: number): [number, number] {
  const a = rand(w) * Math.PI * 2;
  const r = Math.sqrt(minR * minR + rand(w) * (maxR * maxR - minR * minR));
  return [Math.sin(a) * r, Math.cos(a) * r];
}
