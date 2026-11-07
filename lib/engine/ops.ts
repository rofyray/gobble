import { copy } from '../copy';
import type { CreateInput, Op } from '../schema';
import { GobbleError } from './errors';
import { THANKSGIVING_MENU } from './menu-thanksgiving';
import { buildReport } from './reconcile';
import type { Activity, ActivityKind, Claim, Gap, Guest, OpResult, PotluckEvent, Report, Slot } from './types';
import { kebab, normalizeHandle, union } from './vocab';

const ACTIVITY_CAP = 50;

export type IdGen = (event: PotluckEvent) => string;

/** Deterministic claim id: a short hash of slug + version, bumped on collision. */
export const deterministicId: IdGen = (event) => {
  for (let salt = 0; ; salt++) {
    let h = 2166136261;
    for (const ch of `${event.slug}:${event.version}:${event.claims.length}:${salt}`) {
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    }
    const id = `c_${h.toString(36).padStart(6, '0').slice(-6)}`;
    if (!event.claims.some((c) => c.id === id)) return id;
  }
};

export function createEvent(input: CreateInput, nowIso: string, slug: string): { event: PotluckEvent; report: Report; did: string } {
  const host = normalizeHandle(input.host);
  const slots: Slot[] = THANKSGIVING_MENU.map((s) => ({ ...s, skipped: false, custom: false }));
  const event: PotluckEvent = {
    slug,
    title: input.title,
    date: input.date,
    dinnerTime: input.dinnerTime,
    headcount: input.headcount,
    ovens: input.ovens ?? 1,
    turkeyMinutes: input.turkeyMinutes ?? 240,
    restMinutes: 30,
    menu: 'thanksgiving',
    guests: [{ handle: host, diets: [], allergies: [], isHost: true, joinedAt: nowIso }],
    slots,
    claims: [],
    activity: [{ at: nowIso, kind: 'created', text: copy.activity.created(host) }],
    status: 'collecting',
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { event, report: buildReport(event), did: copy.did.created(event.title) };
}

function clone(event: PotluckEvent): PotluckEvent {
  return structuredClone(event);
}

function findSlot(event: PotluckEvent, slotId: string): Slot {
  const slot = event.slots.find((s) => s.id === slotId);
  if (!slot) throw new GobbleError('UNKNOWN_SLOT', `No slot "${slotId}". Run ./gobble slots to see them.`);
  return slot;
}

function findClaim(event: PotluckEvent, claimId: string): Claim {
  const claim = event.claims.find((c) => c.id === claimId);
  if (!claim) throw new GobbleError('UNKNOWN_CLAIM', `No claim "${claimId}".`);
  return claim;
}

function ensureGuest(event: PotluckEvent, handle: string, nowIso: string): { guest: Guest; created: boolean } {
  const existing = event.guests.find((g) => g.handle === handle);
  if (existing) return { guest: existing, created: false };
  const guest: Guest = { handle, diets: [], allergies: [], isHost: false, joinedAt: nowIso };
  event.guests.push(guest);
  return { guest, created: true };
}

function defaultServings(event: PotluckEvent, slot: Slot): number {
  return slot.defaultClaimServings === 'headcount' ? event.headcount : slot.defaultClaimServings;
}

function customSlot(event: PotluckEvent, item: string, category: Slot['category']): Slot {
  const id = `custom-${kebab(item) || 'dish'}`;
  const existing = event.slots.find((s) => s.id === id);
  if (existing) return existing;
  const n = event.slots.filter((s) => s.custom).length + 1;
  const slot: Slot = {
    id, label: item, category, required: 'never', basis: 'headcount', perGuest: 0, minServings: 0,
    defaultClaimServings: 0, impliesTags: [], skipped: false, custom: true, order: 1000 + n,
  };
  event.slots.push(slot);
  return slot;
}

function mutate(event: PotluckEvent, op: Op, nowIso: string, newId: IdGen): { kind: ActivityKind; text: string; did: string } {
  switch (op.op) {
    case 'set_details': {
      const { op: _op, ...patch } = op;
      void _op;
      const onlyHeadcount = Object.keys(patch).length === 1 && patch.headcount !== undefined;
      Object.assign(event, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      if (patch.turkeyMinutes !== undefined) {
        for (const c of event.claims) if (c.slotId === 'turkey' && c.ovenMinutes > 0) c.ovenMinutes = patch.turkeyMinutes;
      }
      return {
        kind: 'details',
        text: onlyHeadcount ? copy.activity.headcount(event.headcount) : copy.activity.details,
        did: copy.did.details,
      };
    }

    case 'guest': {
      const { guest } = ensureGuest(event, normalizeHandle(op.handle), nowIso);
      if (op.displayName !== undefined) guest.displayName = op.displayName;
      if (op.diets !== undefined) guest.diets = union(op.diets);
      if (op.allergies !== undefined) guest.allergies = union(op.allergies);
      if (op.isHost !== undefined) guest.isHost = op.isHost;
      return { kind: 'guest', text: copy.activity.guest(guest.handle), did: copy.did.guest(guest.handle) };
    }

    case 'claim': {
      let slot: Slot;
      if (op.slotId === 'new') {
        if (!op.category) throw new GobbleError('INVALID', 'A new dish needs --category.');
        slot = customSlot(event, op.item, op.category);
      } else {
        slot = findSlot(event, op.slotId);
      }
      slot.skipped = false;
      const handle = normalizeHandle(op.handle);
      ensureGuest(event, handle, nowIso);
      const claim: Claim = {
        id: newId(event),
        slotId: slot.id,
        handle,
        item: op.item,
        servings: op.servings ?? defaultServings(event, slot),
        tags: union(op.tags, slot.impliesTags),
        ovenMinutes: op.ovenMinutes ?? 0,
        tentative: op.tentative ?? false,
        labeled: false,
        createdAt: nowIso,
      };
      event.claims.push(claim);
      return { kind: 'claimed', text: copy.activity.claimed(claim.handle, claim.item), did: copy.did.claimed(claim.item, claim.handle) };
    }

    case 'update_claim': {
      const claim = findClaim(event, op.claimId);
      const oldSlot = findSlot(event, claim.slotId);
      const slot = op.slotId !== undefined ? findSlot(event, op.slotId) : oldSlot;
      const moved = slot.id !== oldSlot.id;
      if (op.item !== undefined) claim.item = op.item;
      if (moved) {
        claim.slotId = slot.id;
        slot.skipped = false;
        if (op.servings === undefined) claim.servings = defaultServings(event, slot);
      }
      if (op.servings !== undefined) claim.servings = op.servings;
      if (op.tags !== undefined) claim.tags = union(op.tags, slot.impliesTags);
      else if (moved) claim.tags = union(claim.tags.filter((t) => !oldSlot.impliesTags.includes(t)), slot.impliesTags);
      if (op.ovenMinutes !== undefined) claim.ovenMinutes = op.ovenMinutes;
      if (op.labeled !== undefined) claim.labeled = op.labeled;
      if (op.tentative !== undefined) claim.tentative = op.tentative;
      return { kind: 'updated', text: copy.activity.updated(claim.handle, claim.item), did: copy.did.updated(claim.item) };
    }

    case 'release': {
      const claim = findClaim(event, op.claimId);
      event.claims = event.claims.filter((c) => c.id !== claim.id);
      return { kind: 'released', text: copy.activity.released(claim.handle, claim.item), did: copy.did.released(claim.item) };
    }

    case 'skip': {
      const slot = findSlot(event, op.slotId);
      slot.skipped = true;
      return { kind: 'skipped', text: copy.activity.skipped(slot.label), did: copy.did.skipped(slot.label) };
    }

    case 'unskip': {
      const slot = findSlot(event, op.slotId);
      slot.skipped = false;
      return { kind: 'unskipped', text: copy.activity.unskipped(slot.label), did: copy.did.unskipped(slot.label) };
    }

    case 'lock':
      event.status = 'locked';
      return { kind: 'locked', text: copy.activity.locked, did: copy.did.locked };

    case 'unlock':
      event.status = 'collecting';
      return { kind: 'unlocked', text: copy.activity.unlocked, did: copy.did.unlocked };
  }
}

/** Pure: same event, op, time and id generator give the same result. */
export function applyOp(event: PotluckEvent, op: Op, nowIso: string, newId: IdGen = deterministicId): OpResult {
  if (event.status === 'locked' && op.op !== 'unlock') {
    throw new GobbleError('LOCKED', copy.cli.locked);
  }
  const before = buildReport(event);
  const next = clone(event);
  const { kind, text, did } = mutate(next, op, nowIso, newId);

  const entry: Activity = { at: nowIso, kind, text };
  next.activity = [...next.activity, entry].slice(-ACTIVITY_CAP);
  next.version += 1;
  next.updatedAt = nowIso;

  const report = buildReport(next);
  const seen = new Set(before.gaps.map((g) => g.id));
  const fresh: Gap[] = report.gaps.filter((g) => !seen.has(g.id));
  return { event: next, report, fresh, did };
}
