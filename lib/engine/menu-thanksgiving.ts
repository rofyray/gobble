import type { Slot } from './types';

type SlotDef = Omit<Slot, 'skipped' | 'custom'>;

export const THANKSGIVING_MENU: SlotDef[] = [
  { id: 'turkey',          label: 'Turkey',              category: 'main',     required: 'always',                          basis: 'headcount',   perGuest: 1,   minServings: 0, defaultClaimServings: 'headcount', impliesTags: [],             order: 10 },
  { id: 'veg-main',        label: 'Vegetarian main',     category: 'main',     required: { ifDiet: ['vegetarian', 'vegan'] }, basis: 'diet-guests', perGuest: 1,   minServings: 4, defaultClaimServings: 8,           impliesTags: ['vegetarian'], order: 20 },
  { id: 'stuffing',        label: 'Stuffing',            category: 'side',     required: 'always',                          basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 30 },
  { id: 'mashed-potatoes', label: 'Mashed potatoes',     category: 'side',     required: 'always',                          basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 40 },
  { id: 'gravy',           label: 'Gravy',               category: 'side',     required: 'always',                          basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 50 },
  { id: 'cranberry-sauce', label: 'Cranberry sauce',     category: 'side',     required: 'always',                          basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 60 },
  { id: 'green-veg',       label: 'Green vegetable',     category: 'side',     required: 'always',                          basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 70 },
  { id: 'sweet-potatoes',  label: 'Sweet potatoes',      category: 'side',     required: 'never',                           basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: [],             order: 80 },
  { id: 'mac-and-cheese',  label: 'Mac and cheese',      category: 'side',     required: 'never',                           basis: 'headcount',   perGuest: 0.6, minServings: 0, defaultClaimServings: 10,          impliesTags: ['contains-dairy', 'contains-gluten'], order: 90 },
  { id: 'rolls',           label: 'Rolls',               category: 'bread',    required: 'always',                          basis: 'headcount',   perGuest: 1.5, minServings: 0, defaultClaimServings: 24,          impliesTags: [],             order: 100 },
  { id: 'dessert',         label: 'Dessert',             category: 'dessert',  required: 'always',                          basis: 'headcount',   perGuest: 1,   minServings: 0, defaultClaimServings: 8,           impliesTags: [],             order: 110 },
  { id: 'drinks-na',       label: 'Soft drinks',         category: 'drinks',   required: 'always',                          basis: 'headcount',   perGuest: 1,   minServings: 0, defaultClaimServings: 'headcount', impliesTags: [],             order: 120 },
  { id: 'wine-beer',       label: 'Wine or beer',        category: 'drinks',   required: 'never',                           basis: 'headcount',   perGuest: 0,   minServings: 0, defaultClaimServings: 0,           impliesTags: [],             order: 130 },
  { id: 'appetizers',      label: 'Appetizers',          category: 'extra',    required: 'never',                           basis: 'headcount',   perGuest: 0,   minServings: 0, defaultClaimServings: 0,           impliesTags: [],             order: 140 },
  { id: 'ice',             label: 'Ice',                 category: 'supplies', required: 'always',                          basis: 'headcount',   perGuest: 0,   minServings: 0, defaultClaimServings: 0,           impliesTags: [],             order: 150 },
  { id: 'plates-cutlery',  label: 'Plates and cutlery',  category: 'supplies', required: 'always',                          basis: 'headcount',   perGuest: 0,   minServings: 0, defaultClaimServings: 0,           impliesTags: [],             order: 160 },
  { id: 'to-go-boxes',     label: 'To-go containers',    category: 'supplies', required: 'never',                           basis: 'headcount',   perGuest: 0,   minServings: 0, defaultClaimServings: 0,           impliesTags: [],             order: 170 },
];

export const CATEGORY_ORDER = ['main', 'side', 'bread', 'dessert', 'drinks', 'supplies', 'extra'] as const;
