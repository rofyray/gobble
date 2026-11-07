import { z } from 'zod';
import { isHHMM, isYMD } from './engine/time';
import { ALLERGENS, CATEGORIES, DIETS, DISH_TAGS, normalizeHandle } from './engine/vocab';

const handle = z.string().trim().min(1).max(64).transform(normalizeHandle).pipe(z.string().regex(/^[a-z0-9._-]+$/, 'handle must be a username'));
const text = z.string().trim().min(1).max(120);
const date = z.string().refine(isYMD, 'date must be YYYY-MM-DD');
const time = z.string().refine(isHHMM, 'time must be HH:MM (24h)');
const minutes = z.number().int().min(0).max(720);
const diet = z.enum(DIETS);
const allergen = z.enum(ALLERGENS);
const tag = z.enum(DISH_TAGS);
const slotId = z.string().trim().min(1).max(80);

export const opSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set_details'),
    title: text.optional(),
    date: date.optional(),
    dinnerTime: time.optional(),
    headcount: z.number().int().min(1).max(500).optional(),
    ovens: z.number().int().min(1).max(10).optional(),
    turkeyMinutes: minutes.optional(),
    restMinutes: minutes.optional(),
  }),
  z.object({
    op: z.literal('guest'),
    handle,
    displayName: text.optional(),
    diets: z.array(diet).optional(),
    allergies: z.array(allergen).optional(),
    isHost: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('claim'),
    handle,
    slotId,
    item: text,
    category: z.enum(CATEGORIES).optional(),
    servings: z.number().int().min(0).max(1000).optional(),
    tags: z.array(tag).optional(),
    ovenMinutes: minutes.optional(),
    tentative: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('update_claim'),
    claimId: z.string().min(1),
    item: text.optional(),
    slotId: slotId.optional(),
    servings: z.number().int().min(0).max(1000).optional(),
    tags: z.array(tag).optional(),
    ovenMinutes: minutes.optional(),
    labeled: z.boolean().optional(),
    tentative: z.boolean().optional(),
  }),
  z.object({ op: z.literal('release'), claimId: z.string().min(1) }),
  z.object({ op: z.literal('skip'), slotId }),
  z.object({ op: z.literal('unskip'), slotId }),
  z.object({ op: z.literal('lock') }),
  z.object({ op: z.literal('unlock') }),
]);

export type Op = z.infer<typeof opSchema>;

export const createSchema = z.object({
  title: text,
  date,
  dinnerTime: time,
  headcount: z.number().int().min(1).max(500),
  host: handle,
  ovens: z.number().int().min(1).max(10).optional(),
  turkeyMinutes: minutes.optional(),
});

export type CreateInput = z.infer<typeof createSchema>;

/** One readable line from a zod error. */
export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}
