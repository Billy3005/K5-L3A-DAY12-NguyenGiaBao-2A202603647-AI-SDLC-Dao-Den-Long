export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';

export interface Player {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  invulnTicks: number;
  pulseCdTicks: number;
  dashCdTicks: number;
  dashTicks: number;
  dashDir: [number, number];
  charmTicks: number;
  launch: [number, number] | null; // pad launch horizontal velocity, kept until landing
  fallWaitTicks: number; // > 0 while waiting to respawn after a fall
  successfulLights: number; // lights + relights this night (capacity growth)
}

export interface Mote { id: string; pos: Vec3; kind: 'random' | 'dropped'; ttl: number | null; point: number | null }
export interface Shade {
  id: string; pos: Vec3; state: ShadeState; stateTicks: number;
  pushTicks: number; pushDir: [number, number]; recoilDir: [number, number];
  evictTicks: number; evictFrom: Vec3 | null; evictStep: number;
  target: string | null; // lantern id the shade walks to / drains
  drainTicks: number;
}
export interface Drifter {
  id: string; pos: Vec3; state: DrifterState; stateTicks: number; stolen: number;
  home: [number, number]; angle: number; fleeSetTick: number;
}
export interface Charm { id: string; pos: Vec3; available: boolean; respawnTicks: number }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number; fuel: number /* 1/60 units */; everLit: boolean; relitCount: number }

export interface Buttons { jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean }

export interface InputState extends Buttons {
  move: [number, number];
  cam_yaw_deg: number;
}

export interface GameEvent { type: 'event'; tick: number; name: string; data: Record<string, unknown> }

export interface World {
  night: 1 | 2 | 3;
  tick: number; // all ticks incl. paused
  simTick: number; // gameplay steps (frozen while paused)
  paused: boolean;
  state: GameState;
  score: number;
  startTimeLeftS: number;
  rngState: number;
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  wind: { ticks: number; dirDeg: number | null };
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  player: Player;
  motes: Mote[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  lanterns: Lantern[];
  prevButtons: Buttons;
}

export const neutralInput = (): InputState => ({
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
});
