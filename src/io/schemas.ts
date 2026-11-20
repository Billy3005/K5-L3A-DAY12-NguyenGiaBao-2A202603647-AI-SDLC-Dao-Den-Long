import { z } from 'zod';

const num = z.number().refine(Number.isFinite, 'must be finite');
const vec3 = z.tuple([num, num, num]);
const count = z.number().int().min(0);

export const ScenarioSchema = z.object({
  player: z.object({ pos: vec3.optional(), carried: count.optional(), flames: count.optional() }).optional(),
  random_motes: z.boolean().optional(),
  random_shades: z.boolean().optional(),
  motes: z.array(vec3).optional(),
  shades: z.array(z.object({ id: z.string().min(1).optional(), pos: vec3 })).optional(),
  lanterns: z.array(z.object({
    id: z.string(), pos: vec3.optional(), deposited: count.optional(), lit: z.boolean().optional(),
  })).optional(),
  time_left_s: num.refine((x) => x >= 0, 'must be >= 0').optional(),
}).superRefine((s, ctx) => {
  const ids = (s.shades ?? []).map((x) => x.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'duplicate shade id' });
});

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
