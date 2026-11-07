export type Category = 'main' | 'side' | 'bread' | 'dessert' | 'drinks' | 'supplies' | 'extra';
export type Diet = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'halal';
export type Allergen = 'tree-nuts' | 'peanuts' | 'dairy' | 'gluten' | 'eggs' | 'shellfish' | 'soy' | 'sesame';
export type DishTag = Diet | `contains-${Allergen}`;

export type Required = 'always' | 'never' | { ifDiet: Diet[] };

export interface Guest {
  handle: string;          // lowercase, no "@"
  displayName?: string;
  diets: Diet[];
  allergies: Allergen[];
  isHost: boolean;
  joinedAt: string;        // ISO
}

export interface Slot {
  id: string;              // kebab-case, stable (Section 7)
  label: string;
  category: Category;
  required: Required;
  basis: 'headcount' | 'diet-guests';
  perGuest: number;        // servings per basis unit; 0 = boolean slot (covered by one claim)
  minServings: number;     // floor for servings needed (0 if none)
  defaultClaimServings: number | 'headcount';
  impliesTags: DishTag[];  // tags auto-added to claims in this slot
  skipped: boolean;        // host said "skip it"
  custom: boolean;         // created by a guest's off-menu dish
  order: number;           // display + priority order
}

export interface Claim {
  id: string;              // "c_" + nanoid(6)
  slotId: string;
  handle: string;
  item: string;            // what they said, e.g. "Pecan pie"
  servings: number;
  tags: DishTag[];
  ovenMinutes: number;     // minutes of oven time needed AT the host's place; 0 = arrives ready
  tentative: boolean;      // someone claimed on their behalf; owner hasn't confirmed
  labeled: boolean;        // owner agreed to label + separate an allergen dish
  createdAt: string;
}

export type ActivityKind =
  | 'created' | 'claimed' | 'released' | 'updated' | 'guest' | 'details' | 'skipped' | 'unskipped' | 'locked' | 'unlocked';

export interface Activity { at: string; kind: ActivityKind; text: string; }

export interface PotluckEvent {
  slug: string;            // nanoid(10), lowercase
  title: string;           // "Thanksgiving at Rofy's"
  date: string;            // YYYY-MM-DD
  dinnerTime: string;      // HH:MM 24h
  headcount: number;       // includes host
  ovens: number;           // default 1
  turkeyMinutes: number;   // default 240 (host can override)
  restMinutes: number;     // default 30: turkey rests, oven free for rewarming
  menu: 'thanksgiving';
  guests: Guest[];
  slots: Slot[];
  claims: Claim[];
  activity: Activity[];    // newest last, capped at 50
  status: 'collecting' | 'locked';
  version: number;         // +1 on every op
  createdAt: string;
  updatedAt: string;
}

export type GapKind =
  | 'ALLERGEN_CONFLICT' | 'ALLERGEN_NO_SAFE_OPTION' | 'UNCLAIMED_REQUIRED' | 'DIET_UNCOVERED'
  | 'SHORTFALL' | 'OVEN_CONFLICT' | 'DOUBLED' | 'TENTATIVE';

export interface Gap {
  id: string;              // deterministic, see Section 8.6
  kind: GapKind;
  severity: 'blocking' | 'warning';
  slotId?: string;
  claimIds?: string[];
  diet?: Diet;
  allergen?: Allergen;
  category?: Category;
  askHandles: string[];    // who Gobble should @mention (max 2)
  swapTo?: string;         // DOUBLED only: an open required slot id to suggest
  numbers?: { needed?: number; have?: number; short?: number; minutes?: number; window?: number; until?: string };
  hint: string;            // human sentence from copy.gapHint (shown on the board's NEXT UP)
}

export type SlotStatus = 'open' | 'owned' | 'short' | 'doubled' | 'flagged' | 'oven' | 'optional' | 'skipped';

export interface SlotView {
  id: string; label: string; category: Category; order: number;
  required: boolean; status: SlotStatus; needed: number; have: number;
  claims: Claim[];
}

export interface OvenPlan {
  ovens: number;
  turkey?: { claimId: string; start: string; end: string };  // HH:MM
  window?: { start: string; end: string };
  rewarm: { claimId: string; item: string; handle: string; minutes: number }[];
  conflicts: string[];     // claim ids
}

export interface Report {
  complete: boolean;       // no blocking gaps
  ready: boolean;          // complete AND no warnings
  counts: { required: number; owned: number; blocking: number; warnings: number };
  gaps: Gap[];             // sorted by priority (Section 8.6)
  next: Gap | null;        // gaps[0]
  slots: SlotView[];
  oven: OvenPlan;
  table: { diets: Partial<Record<Diet, number>>; allergies: Partial<Record<Allergen, number>> }; // aggregated, no names
}

export interface OpResult { event: PotluckEvent; report: Report; fresh: Gap[]; did: string; }
