import { z } from 'zod';

const num = z.number().refine(Number.isFinite, 'must be finite');
const vec3 = z.tuple([num, num, num]);
const count = z.number().int().min(0);
const shadeState = z.enum(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
const drifterState = z.enum(['idle', 'chase', 'flee', 'removed']);

const uniqueIds = (key: 'shades' | 'drifters' | 'charms') => (s: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const ids = ((s[key] as { id?: string }[] | undefined) ?? []).map((x) => x.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `duplicate ${key} id` });
};

export const ScenarioSchema = z.object({
  player: z.object({
    pos: vec3.optional(), carried: count.optional(), flames: count.optional(),
    invuln_ticks: count.optional(), dash_cd_ticks: count.optional(), pulse_cd_ticks: count.optional(), charm_ticks: count.optional(),
    successful_lights: count.optional(),
  }).optional(),
  random_motes: z.boolean().optional(),
  random_shades: z.boolean().optional(),
  random_drifters: z.boolean().optional(),
  wind_enabled: z.boolean().optional(),
  motes: z.array(vec3).optional(),
  shades: z.array(z.object({
    id: z.string().min(1).optional(), pos: vec3, state: shadeState.optional(), state_ticks_left: count.optional(), target_lantern_id: z.string().optional(),
  })).optional(),
  drifters: z.array(z.object({
    id: z.string().min(1).optional(), pos: vec3, state: drifterState.optional(), stolen: count.optional(), state_ticks_left: count.optional(),
  })).optional(),
  charms: z.array(z.object({ id: z.string().min(1), pos: vec3.optional(), available: z.boolean().optional(), respawn_ticks: count.optional() })).optional(),
  lanterns: z.array(z.object({
    id: z.string(), pos: vec3.optional(), deposited: count.optional(), lit: z.boolean().optional(),
    fuel: num.refine((x) => x >= 0 && x <= 100, 'fuel must be in [0, 100]').optional(), ever_lit: z.boolean().optional(),
  })).optional(),
  time_left_s: num.refine((x) => x >= 0, 'must be >= 0').optional(),
}).superRefine(uniqueIds('shades')).superRefine(uniqueIds('drifters')).superRefine(uniqueIds('charms'));

const axis = num.refine((x) => x >= -1 && x <= 1, 'move component must be in [-1, 1]');

export const InputsSchema = z.object({
  frames: z.array(z.object({
    tick: z.number().int().min(0),
    move: z.tuple([axis, axis]).optional(),
    cam_yaw_deg: num.optional(),
    jump: z.boolean().optional(),
    interact: z.boolean().optional(),
    pulse: z.boolean().optional(),
    dash: z.boolean().optional(),
    pause: z.boolean().optional(),
  })),
}).superRefine((f, ctx) => {
  for (let i = 1; i < f.frames.length; i++) {
    if (f.frames[i].tick <= f.frames[i - 1].tick) {
      ctx.addIssue({ code: 'custom', message: `frame ticks must strictly increase (index ${i})` });
      return;
    }
  }
});

export type InputsFile = z.infer<typeof InputsSchema>;
