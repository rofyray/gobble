// The Section 17 chat script as engine ops. `demo` is the locked end state;
// `demoMid` is the mid-plan state from the approved board mock.
import type { Op } from '../../schema';
import { applyOp, createEvent } from '../ops';
import type { PotluckEvent } from '../types';

type Step = (event: PotluckEvent) => Op[];

const claimOf = (event: PotluckEvent, handle: string, slotId: string) => {
  const claim = event.claims.find((c) => c.handle === handle && c.slotId === slotId);
  if (!claim) throw new Error(`demo fixture: no ${slotId} claim for ${handle}`);
  return claim.id;
};

export const DEMO_CREATE = {
  title: "Thanksgiving at Rofy's",
  date: '2026-11-26',
  dinnerTime: '16:00',
  headcount: 15,
  host: 'rofy',
  turkeyMinutes: 240,
};

/** Steps 1 to 12 of the chat script, keyed by step number. */
export const DEMO_STEPS: Record<number, Step> = {
  1: () => [
    { op: 'guest', handle: 'rofy', displayName: 'Rofy' },
    { op: 'claim', handle: 'rofy', slotId: 'turkey', item: 'Turkey', ovenMinutes: 240 },
    { op: 'claim', handle: 'rofy', slotId: 'gravy', item: 'Gravy' },
    { op: 'claim', handle: 'rofy', slotId: 'cranberry-sauce', item: 'Cranberry sauce' },
    { op: 'claim', handle: 'rofy', slotId: 'plates-cutlery', item: 'Plates and cutlery' },
    { op: 'claim', handle: 'rofy', slotId: 'ice', item: 'Ice' },
  ],
  2: () => [
    { op: 'guest', handle: 'tayo', diets: ['vegetarian'] },
    { op: 'claim', handle: 'tayo', slotId: 'veg-main', item: 'Mushroom wellington', ovenMinutes: 40 },
  ],
  3: (e) => [{ op: 'update_claim', claimId: claimOf(e, 'tayo', 'veg-main'), ovenMinutes: 0 }],
  4: () => [{ op: 'claim', handle: 'kunda', slotId: 'dessert', item: 'Dessert (type TBD)' }],
  5: () => [
    { op: 'claim', handle: 'kia', slotId: 'dessert', item: 'Pecan pie', tags: ['contains-tree-nuts'] },
    { op: 'claim', handle: 'kia', slotId: 'mashed-potatoes', item: 'Mashed potatoes' },
  ],
  6: () => [
    { op: 'guest', handle: 'cee', allergies: ['tree-nuts'] },
    { op: 'claim', handle: 'cee', slotId: 'drinks-na', item: 'Drinks' },
  ],
  7: (e) => [{ op: 'update_claim', claimId: claimOf(e, 'kia', 'dessert'), labeled: true }],
  8: (e) => [
    { op: 'update_claim', claimId: claimOf(e, 'kunda', 'dessert'), item: 'Pumpkin pie' },
    { op: 'claim', handle: 'kunda', slotId: 'mashed-potatoes', item: 'Mashed potatoes' },
  ],
  9: (e) => [{ op: 'update_claim', claimId: claimOf(e, 'kunda', 'mashed-potatoes'), slotId: 'green-veg', item: 'Green beans' }],
  10: () => [{ op: 'claim', handle: 'cee', slotId: 'stuffing', item: 'Stuffing' }],
  11: () => [{ op: 'claim', handle: 'tayo', slotId: 'rolls', item: 'Rolls' }],
  12: () => [{ op: 'lock' }],
};

const BASE = Date.UTC(2026, 10, 20, 18, 0, 0);
const at = (i: number) => new Date(BASE + i * 60_000).toISOString();

/** Builds an event by running the given steps in order. Extra ops run after them. */
export function runDemo(slug: string, steps: number[], extra: Step[] = []): PotluckEvent {
  let tick = 0;
  let event = createEvent(DEMO_CREATE, at(tick++), slug).event;
  for (const step of [...steps.map((n) => DEMO_STEPS[n]), ...extra]) {
    for (const op of step(event)) event = applyOp(event, op, at(tick++)).event;
  }
  return event;
}

export const demo: PotluckEvent = runDemo('demo', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

export const demoMid: PotluckEvent = runDemo('demo-mid', [1, 2, 4, 5, 6], [
  () => [{ op: 'claim', handle: 'kunda', slotId: 'mashed-potatoes', item: 'Mashed potatoes' }],
]);

export const FIXTURES: Record<string, PotluckEvent> = { demo, 'demo-mid': demoMid };
