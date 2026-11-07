import type { Allergen, Category, Diet, DishTag } from './types';

export const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal'] as const satisfies readonly Diet[];
export const ALLERGENS = [
  'tree-nuts', 'peanuts', 'dairy', 'gluten', 'eggs', 'shellfish', 'soy', 'sesame',
] as const satisfies readonly Allergen[];
export const CATEGORIES = [
  'main', 'side', 'bread', 'dessert', 'drinks', 'supplies', 'extra',
] as const satisfies readonly Category[];
export const DISH_TAGS = [
  ...DIETS,
  ...ALLERGENS.map((a) => `contains-${a}` as const),
] as const satisfies readonly DishTag[];

export const isDiet = (s: string): s is Diet => (DIETS as readonly string[]).includes(s);
export const isAllergen = (s: string): s is Allergen => (ALLERGENS as readonly string[]).includes(s);
export const isCategory = (s: string): s is Category => (CATEGORIES as readonly string[]).includes(s);
export const isDishTag = (s: string): s is DishTag => (DISH_TAGS as readonly string[]).includes(s);

export const containsTag = (a: Allergen): DishTag => `contains-${a}`;

/** Allergens a set of tags declares, in vocabulary order. */
export function allergensIn(tags: readonly DishTag[]): Allergen[] {
  return ALLERGENS.filter((a) => tags.includes(containsTag(a)));
}

/** Lowercase, strip a leading "@", trim. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

export function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Ordered union without duplicates. */
export function union<T>(...lists: readonly (readonly T[] | undefined)[]): T[] {
  const out: T[] = [];
  for (const list of lists) for (const x of list ?? []) if (!out.includes(x)) out.push(x);
  return out;
}
