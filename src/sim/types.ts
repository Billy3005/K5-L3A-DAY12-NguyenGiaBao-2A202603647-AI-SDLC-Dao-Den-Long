export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'chase' | 'stunned';

export interface Player {
  pos: Vec3;
  vy: number;
  flames: number;
  carried: number;
  invulnTicks: number;
  pulseCdTicks: number;
}

export interface Mote { id: string; pos: Vec3 }
export interface Shade { id: string; pos: Vec3; state: ShadeState; stunTicks: number }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }

export interface Buttons { jump: boolean; interact: boolean; pulse: boolean }

export interface InputState extends Buttons {
  move: [number, number];
  cam_yaw_deg: number;
}

export interface GameEvent { type: 'event'; tick: number; name: string; data: Record<string, unknown> }

export interface World {
  tick: number; // steps executed
  state: GameState;
  score: number;
  startTimeLeftS: number;
  rngState: number;
  randomMotes: boolean;
  randomShades: boolean;
  nextMoteId: number;
  nextShadeId: number;
  shadeSpawnTicks: number;
  player: Player;
  motes: Mote[];
  shades: Shade[];
  lanterns: Lantern[];
  prevButtons: Buttons;
}

export const neutralInput = (): InputState => ({
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false,
});
