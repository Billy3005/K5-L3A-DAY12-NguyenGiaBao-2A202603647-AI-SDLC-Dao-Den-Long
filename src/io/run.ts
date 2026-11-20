import { createWorld, type Scenario } from '../sim/world';
import { step } from '../sim/step';
import { snapshot } from '../sim/snapshot';
import { neutralInput, type InputState } from '../sim/types';
import type { InputsFile } from './schemas';

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: Scenario;
  inputs?: InputsFile;
}

/** Pure headless run: returns JSONL lines (no I/O). */
export function runHeadless(o: RunOptions): string[] {
  const every = o.snapshotEvery ?? 10;
  const w = createWorld(o.seed, o.scenario);
  const frames = new Map((o.inputs?.frames ?? []).map((f) => [f.tick, f]));
  const cur: InputState = neutralInput();
  const out: string[] = [JSON.stringify(snapshot(w))];

  for (let k = 0; k < o.ticks && w.state === 'playing'; k++) {
    const f = frames.get(k);
    if (f) {
      if (f.move) cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) cur.jump = f.jump;
      if (f.interact !== undefined) cur.interact = f.interact;
      if (f.pulse !== undefined) cur.pulse = f.pulse;
    }
    for (const e of step(w, cur)) out.push(JSON.stringify(e));
    if (w.tick % every === 0) out.push(JSON.stringify(snapshot(w)));
  }
  out.push(JSON.stringify({ type: 'end', ticks: w.tick, state: w.state, score: w.score }));
  return out;
}
