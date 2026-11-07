import { copy } from '../copy';
import { CATEGORY_ORDER } from './menu-thanksgiving';
import { addMinutes } from './time';
import type {
  Allergen, Category, Claim, Diet, DishTag, Gap, GapKind, Guest, OvenPlan, PotluckEvent, Report, Slot,
  SlotStatus, SlotView,
} from './types';
import { allergensIn, containsTag, union, DIETS } from './vocab';

/** Section 8.3: which categories each diet needs covered, and which tags count. */
const DIET_RULES: Record<Diet, { categories: Category[]; matches: DishTag[] }> = {
  vegetarian: { categories: ['main'], matches: ['vegetarian', 'vegan'] },
  vegan: { categories: ['main', 'dessert'], matches: ['vegan'] },
  halal: { categories: ['main'], matches: ['halal'] },
  'gluten-free': { categories: ['dessert'], matches: ['gluten-free'] },
  'dairy-free': { categories: ['dessert'], matches: ['dairy-free', 'vegan'] },
};

const SAFE_OPTION_CATEGORIES: Category[] = ['main', 'side', 'dessert'];
const REWARM_CAPACITY = 3;

// ---------- 8.1 derived values ----------

export function dietGuests(event: PotluckEvent, diets: Diet[]): number {
  return event.guests.filter((g) => g.diets.some((d) => diets.includes(d))).length;
}

export function isRequired(event: PotluckEvent, slot: Slot): boolean {
  if (slot.skipped) return false;
  if (slot.required === 'always') return true;
  if (slot.required === 'never') return false;
  return dietGuests(event, slot.required.ifDiet) > 0;
}

export const isBoolean = (slot: Slot) => slot.perGuest === 0;

export function needed(event: PotluckEvent, slot: Slot): number {
  if (isBoolean(slot)) return 0;
  const basis = slot.basis === 'headcount' ? event.headcount : dietGuests(event, ['vegetarian', 'vegan']);
  return Math.max(slot.minServings, Math.ceil(basis * slot.perGuest));
}

const sumServings = (claims: Claim[]) => claims.reduce((n, c) => n + c.servings, 0);

function haveOf(slot: Slot, claims: Claim[]): number {
  return isBoolean(slot) ? claims.length : sumServings(claims);
}

function coveredBy(event: PotluckEvent, slot: Slot, claims: Claim[]): boolean {
  return isBoolean(slot) ? claims.length >= 1 : haveOf(slot, claims) >= needed(event, slot);
}

/** Claims sorted oldest first; ties keep insertion order. */
function byCreated(claims: Claim[]): Claim[] {
  return claims
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.createdAt < b.c.createdAt ? -1 : a.c.createdAt > b.c.createdAt ? 1 : a.i - b.i))
    .map(({ c }) => c);
}

// ---------- 8.7 askHandles ----------

function candidates(event: PotluckEvent): string[] {
  const count = (h: string) => event.claims.filter((c) => c.handle === h).length;
  const guests = event.guests.filter((g) => !g.isHost);
  if (guests.length === 0) return event.guests.filter((g) => g.isHost).map((g) => g.handle);
  return [...guests]
    .sort((a, b) =>
      count(a.handle) - count(b.handle) ||
      (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0) ||
      (a.handle < b.handle ? -1 : 1))
    .map((g) => g.handle);
}

const cap2 = (handles: (string | undefined)[]) => union(handles.filter((h): h is string => !!h)).slice(0, 2);

// ---------- report ----------

interface Ctx {
  event: PotluckEvent;
  slotById: Map<string, Slot>;
  claimsBySlot: Map<string, Claim[]>;
  cands: string[];
}

function slotOf(ctx: Ctx, claim: Claim): Slot | undefined {
  return ctx.slotById.get(claim.slotId);
}

function claimTags(ctx: Ctx, claim: Claim): DishTag[] {
  return union(claim.tags, slotOf(ctx, claim)?.impliesTags);
}

/** Claims that count toward a category: their slot exists and is not skipped. */
function claimsInCategory(ctx: Ctx, category: Category): Claim[] {
  return ctx.event.claims.filter((c) => {
    const s = slotOf(ctx, c);
    return s && !s.skipped && s.category === category;
  });
}

function makeGap(
  ctx: Ctx,
  base: Omit<Gap, 'severity' | 'hint' | 'askHandles'> & { askHandles?: string[] },
  hintText: string,
): Gap {
  const blocking: GapKind[] = [
    'ALLERGEN_CONFLICT', 'ALLERGEN_NO_SAFE_OPTION', 'UNCLAIMED_REQUIRED', 'DIET_UNCOVERED', 'SHORTFALL', 'OVEN_CONFLICT',
  ];
  return {
    ...base,
    severity: blocking.includes(base.kind) ? 'blocking' : 'warning',
    askHandles: base.askHandles ?? cap2(ctx.cands.slice(0, 2)),
    hint: hintText,
  };
}

function slotGaps(ctx: Ctx, gaps: Gap[]) {
  const { event } = ctx;
  for (const slot of [...event.slots].sort((a, b) => a.order - b.order)) {
    if (slot.skipped) continue;
    const claims = byCreated(ctx.claimsBySlot.get(slot.id) ?? []);
    const required = isRequired(event, slot);

    if (required && claims.length === 0) {
      gaps.push(makeGap(ctx, { id: `UNCLAIMED_REQUIRED:${slot.id}`, kind: 'UNCLAIMED_REQUIRED', slotId: slot.id, category: slot.category },
        copy.gapHint.UNCLAIMED_REQUIRED({ slot: slot.label })));
    }

    if (required && claims.length > 0 && !isBoolean(slot)) {
      const need = needed(event, slot);
      const have = haveOf(slot, claims);
      if (have < need) {
        gaps.push(makeGap(ctx, {
          id: `SHORTFALL:${slot.id}`, kind: 'SHORTFALL', slotId: slot.id, category: slot.category,
          claimIds: claims.map((c) => c.id),
          askHandles: cap2([claims[0].handle, ctx.cands[0]]),
          numbers: { needed: need, have, short: need - have },
        }, copy.gapHint.SHORTFALL({ slot: slot.label, short: need - have })));
      }
    }

    if (claims.length >= 2) {
      const recent = claims[claims.length - 1];
      const rest = claims.slice(0, -1);
      if (coveredBy(event, slot, rest)) {
        const swap = [...event.slots]
          .sort((a, b) => a.order - b.order)
          .find((s) => isRequired(event, s) && (ctx.claimsBySlot.get(s.id) ?? []).length === 0);
        gaps.push(makeGap(ctx, {
          id: `DOUBLED:${slot.id}`, kind: 'DOUBLED', slotId: slot.id, category: slot.category,
          claimIds: [recent.id],
          askHandles: cap2([recent.handle, ...rest.map((c) => c.handle).reverse()]),
          swapTo: swap?.id,
        }, copy.gapHint.DOUBLED({ slot: slot.label, swapTo: swap?.label })));
      }
    }

    for (const c of claims) {
      if (!c.tentative) continue;
      gaps.push(makeGap(ctx, {
        id: `TENTATIVE:${c.id}`, kind: 'TENTATIVE', slotId: slot.id, category: slot.category, claimIds: [c.id],
        askHandles: [c.handle],
      }, copy.gapHint.TENTATIVE({ item: c.item, handle: c.handle })));
    }
  }
}

function dietGaps(ctx: Ctx, gaps: Gap[]) {
  const { event } = ctx;
  for (const diet of DIETS) {
    const n = dietGuests(event, [diet]);
    if (n === 0) continue;
    const rule = DIET_RULES[diet];
    for (const category of rule.categories) {
      const matched = claimsInCategory(ctx, category).some((c) => claimTags(ctx, c).some((t) => rule.matches.includes(t)));
      if (matched) continue;
      const suppressed = gaps.some((g) => {
        if (g.kind !== 'UNCLAIMED_REQUIRED' || g.category !== category || !g.slotId) return false;
        const slot = ctx.slotById.get(g.slotId);
        return !!slot && slot.impliesTags.some((t) => rule.matches.includes(t));
      });
      if (suppressed) continue;
      gaps.push(makeGap(ctx, {
        id: `DIET_UNCOVERED:${diet}:${category}`, kind: 'DIET_UNCOVERED', diet, category, numbers: { needed: n },
      }, copy.gapHint.DIET_UNCOVERED({ diet, category })));
    }
  }
}

function allergenGaps(ctx: Ctx, gaps: Gap[]) {
  const { event } = ctx;
  const present = union(...event.guests.map((g) => g.allergies));
  if (present.length === 0) return;
  const atTable = (a: Allergen) => present.includes(a);

  for (const c of byCreated(event.claims)) {
    const slot = slotOf(ctx, c);
    if (!slot || slot.skipped || c.labeled) continue;
    const hit = allergensIn(claimTags(ctx, c)).find(atTable);
    if (!hit) continue;
    const peer = ctx.cands.find(
      (h) => h !== c.handle && claimsInCategory(ctx, slot.category).some((o) => o.handle === h),
    );
    gaps.push(makeGap(ctx, {
      id: `ALLERGEN_CONFLICT:${c.id}`, kind: 'ALLERGEN_CONFLICT', slotId: slot.id, category: slot.category,
      claimIds: [c.id], allergen: hit, askHandles: cap2([c.handle, peer]),
    }, copy.gapHint.ALLERGEN_CONFLICT({ item: c.item, allergen: hit })));
  }

  for (const a of present) {
    for (const category of SAFE_OPTION_CATEGORIES) {
      const claims = claimsInCategory(ctx, category);
      if (claims.length === 0) continue;
      if (!claims.every((c) => claimTags(ctx, c).includes(containsTag(a)))) continue;
      gaps.push(makeGap(ctx, {
        id: `ALLERGEN_NO_SAFE_OPTION:${a}:${category}`, kind: 'ALLERGEN_NO_SAFE_OPTION', allergen: a, category,
        claimIds: claims.map((c) => c.id),
      }, copy.gapHint.ALLERGEN_NO_SAFE_OPTION({ allergen: a, category })));
    }
  }
}

function ovenPlan(ctx: Ctx, gaps: Gap[]): OvenPlan {
  const { event } = ctx;
  const live = byCreated(event.claims).filter((c) => {
    const s = slotOf(ctx, c);
    return s && !s.skipped && c.ovenMinutes > 0;
  });
  const turkeyClaim = live.find((c) => c.slotId === 'turkey');
  const others = live.filter((c) => c !== turkeyClaim);
  const plan: OvenPlan = { ovens: event.ovens, rewarm: [], conflicts: [] };
  const entry = (c: Claim) => ({ claimId: c.id, item: c.item, handle: c.handle, minutes: c.ovenMinutes });

  if (turkeyClaim) {
    const end = addMinutes(event.dinnerTime, -event.restMinutes);
    plan.turkey = { claimId: turkeyClaim.id, start: addMinutes(end, -turkeyClaim.ovenMinutes), end };
    plan.window = { start: end, end: event.dinnerTime };
  }

  if (event.ovens >= 2 || !turkeyClaim || !plan.window) {
    plan.rewarm = others.map(entry);
    return plan;
  }

  for (const c of others) {
    const tooLong = c.ovenMinutes > event.restMinutes;
    if (tooLong || plan.rewarm.length >= REWARM_CAPACITY) {
      plan.conflicts.push(c.id);
      const slot = slotOf(ctx, c);
      gaps.push(makeGap(ctx, {
        id: `OVEN_CONFLICT:${c.id}`, kind: 'OVEN_CONFLICT', slotId: c.slotId, category: slot?.category,
        claimIds: [c.id], askHandles: [c.handle],
        numbers: { minutes: c.ovenMinutes, window: event.restMinutes, until: plan.window.start },
      }, tooLong
        ? copy.gapHint.OVEN_CONFLICT_LONG({ item: c.item, minutes: c.ovenMinutes, window: event.restMinutes })
        : copy.gapHint.OVEN_CONFLICT_FULL({ item: c.item })));
    } else {
      plan.rewarm.push(entry(c));
    }
  }
  return plan;
}

// ---------- 8.6 priority ----------

function rank(ctx: Ctx, g: Gap): number {
  switch (g.kind) {
    case 'ALLERGEN_CONFLICT': return 1;
    case 'ALLERGEN_NO_SAFE_OPTION': return 2;
    case 'UNCLAIMED_REQUIRED': return ctx.slotById.get(g.slotId ?? '')?.category === 'main' ? 3 : 5;
    case 'DIET_UNCOVERED': return 4;
    case 'SHORTFALL': return 6;
    case 'OVEN_CONFLICT': return 7;
    case 'DOUBLED': return 8;
    case 'TENTATIVE': return 9;
  }
}

function orderKey(ctx: Ctx, g: Gap): number {
  const slot = g.slotId ? ctx.slotById.get(g.slotId) : undefined;
  if (slot) return slot.order;
  if (g.category) {
    const orders = ctx.event.slots.filter((s) => s.category === g.category).map((s) => s.order);
    return orders.length ? Math.min(...orders) : 1000 + CATEGORY_ORDER.indexOf(g.category);
  }
  return Number.MAX_SAFE_INTEGER;
}

function createdKey(ctx: Ctx, g: Gap): string {
  const id = g.claimIds?.[0];
  return (id && ctx.event.claims.find((c) => c.id === id)?.createdAt) || '';
}

function sortGaps(ctx: Ctx, gaps: Gap[]): Gap[] {
  return [...gaps].sort((a, b) => {
    const r = rank(ctx, a) - rank(ctx, b);
    if (r) return r;
    const o = orderKey(ctx, a) - orderKey(ctx, b);
    if (o) return o;
    const ca = createdKey(ctx, a);
    const cb = createdKey(ctx, b);
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------- slot views ----------

const STATUS_FOR: Partial<Record<GapKind, SlotStatus>> = {
  ALLERGEN_CONFLICT: 'flagged',
  UNCLAIMED_REQUIRED: 'open',
  SHORTFALL: 'short',
  OVEN_CONFLICT: 'oven',
  DOUBLED: 'doubled',
};

function slotViews(ctx: Ctx, sorted: Gap[]): SlotView[] {
  const { event } = ctx;
  return [...event.slots]
    .sort((a, b) => a.order - b.order)
    .map((slot) => {
      const claims = byCreated(ctx.claimsBySlot.get(slot.id) ?? []);
      const required = isRequired(event, slot);
      let status: SlotStatus;
      if (slot.skipped) status = 'skipped';
      else {
        const top = sorted.find((g) => g.slotId === slot.id && STATUS_FOR[g.kind]);
        status = top ? STATUS_FOR[top.kind]! : claims.length === 0 ? 'optional' : 'owned';
      }
      return {
        id: slot.id, label: slot.label, category: slot.category, order: slot.order,
        required, status, needed: needed(event, slot), have: haveOf(slot, claims), claims,
      };
    });
}

function tableOf(guests: Guest[]): Report['table'] {
  const diets: Report['table']['diets'] = {};
  const allergies: Report['table']['allergies'] = {};
  for (const g of guests) {
    for (const d of g.diets) diets[d] = (diets[d] ?? 0) + 1;
    for (const a of g.allergies) allergies[a] = (allergies[a] ?? 0) + 1;
  }
  return { diets, allergies };
}

export function buildReport(event: PotluckEvent): Report {
  const slotById = new Map(event.slots.map((s) => [s.id, s]));
  const claimsBySlot = new Map<string, Claim[]>();
  for (const c of event.claims) claimsBySlot.set(c.slotId, [...(claimsBySlot.get(c.slotId) ?? []), c]);
  const ctx: Ctx = { event, slotById, claimsBySlot, cands: candidates(event) };

  const gaps: Gap[] = [];
  slotGaps(ctx, gaps);
  dietGaps(ctx, gaps);
  allergenGaps(ctx, gaps);
  const oven = ovenPlan(ctx, gaps);

  const sorted = sortGaps(ctx, gaps);
  const slots = slotViews(ctx, sorted);
  const requiredSlots = slots.filter((s) => s.required);
  const blocking = sorted.filter((g) => g.severity === 'blocking').length;
  const warnings = sorted.length - blocking;

  return {
    complete: blocking === 0,
    ready: blocking === 0 && warnings === 0,
    counts: {
      required: requiredSlots.length,
      owned: requiredSlots.filter((s) => s.claims.length > 0).length,
      blocking,
      warnings,
    },
    gaps: sorted,
    next: sorted[0] ?? null,
    slots,
    oven,
    table: tableOf(event.guests),
  };
}
