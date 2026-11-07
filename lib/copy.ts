import type { Allergen, Category, Diet, DishTag, GapKind } from './engine/types';

const allergenWord: Record<Allergen, string> = {
  'tree-nuts': 'tree nuts', peanuts: 'peanuts', dairy: 'dairy', gluten: 'gluten',
  eggs: 'eggs', shellfish: 'shellfish', soy: 'soy', sesame: 'sesame',
};
const allergyWord: Record<Allergen, string> = {
  'tree-nuts': 'tree-nut', peanuts: 'peanut', dairy: 'dairy', gluten: 'gluten',
  eggs: 'egg', shellfish: 'shellfish', soy: 'soy', sesame: 'sesame',
};
const categoryWord: Record<Category, string> = {
  main: 'main', side: 'side', bread: 'bread', dessert: 'dessert', drinks: 'drink', supplies: 'supply', extra: 'extra',
};

export const copy = {
  brand: { name: 'Gobble', tagline: 'Every dish gets an owner.' },

  words: { allergenWord, allergyWord, categoryWord },

  board: {
    eyebrow: 'ORDER UP',
    meta: (weekday: string, date: string, time: string, headcount: number) =>
      `${weekday} ${date} · dinner ${time} · ${headcount} guests`,
    categories: {
      main: 'MAINS', side: 'SIDES', bread: 'BREAD', dessert: 'DESSERT',
      drinks: 'DRINKS', supplies: 'SUPPLIES', extra: 'EXTRAS',
    } satisfies Record<Category, string>,
    ticketNo: (n: number) => `#${String(n).padStart(2, '0')}`,
    stamps: {
      open: 'NEEDS A COOK',
      owned: 'ON IT',
      short: (n: number) => `SHORT ${n}`,
      doubled: 'DOUBLED',
      flagged: 'LABEL IT',
      oven: 'OVEN CLASH',
      optional: 'NICE TO HAVE',
    },
    servings: (have: number, needed: number) => (needed > 0 ? `${have} of ~${needed} servings` : ''),
    serves: (n: number) => (n > 0 ? `serves ${n}` : ''),
    oven: (m: number) => `oven ${m} min`,
    tags: {
      vegetarian: 'VEG', vegan: 'VEGAN', 'gluten-free': 'GF', 'dairy-free': 'DF', halal: 'HALAL',
      'contains-tree-nuts': 'NUTS', 'contains-peanuts': 'PEANUTS', 'contains-dairy': 'DAIRY',
      'contains-gluten': 'GLUTEN', 'contains-eggs': 'EGGS', 'contains-shellfish': 'SHELLFISH',
      'contains-soy': 'SOY', 'contains-sesame': 'SESAME',
    } satisfies Record<DishTag, string>,
    tentative: 'unconfirmed',
    labeled: 'LABELED',
    noOneYet: 'no one yet',
    pass: {
      title: 'THE PASS',
      owned: (owned: number, required: number) => `${owned}/${required}`,
      ownedLabel: 'owned',
      blocking: (n: number) => `${n}`,
      blockingLabel: (n: number) => (n === 1 ? 'to sort' : 'to sort'),
      warnings: (n: number) => `${n}`,
      warningsLabel: (n: number) => (n === 1 ? 'heads-up' : 'heads-ups'),
      nextTitle: 'NEXT UP',
      nothing: 'Nothing left to sort.',
      tableTitle: 'AT THE TABLE',
      tableEmpty: 'No food needs shared yet.',
      diet: (diet: Diet, n: number) => `${n} ${diet}`,
      allergy: (a: Allergen, n: number) => `${n} ${allergyWord[a]} allergy`,
      ovenTitle: 'OVEN',
      ovenFree: 'Oven is free all day.',
      turkey: (start: string, end: string) => `Turkey ${start} to ${end}`,
      rewarm: 'Rewarm',
      activityTitle: 'ON THE RAIL',
    },
    complete: 'ALL ORDERS OWNED',
    locked: (time: string) => `LOCKED · SEE YOU AT ${time}`,
    footer: 'Kept by Gobble in Switch. Updates live.',
    loading: 'Warming up the rail…',
    notFound: { title: 'No potluck on this rail.', body: 'Check the link Gobble posted in your chat.' },
    error: 'The rail jammed. Trying again in a few seconds.',
    stale: 'Reconnecting…',
  },

  gapHint: {
    UNCLAIMED_REQUIRED: (p: { slot: string }) => `Nobody has ${p.slot.toLowerCase()} yet.`,
    SHORTFALL: (p: { slot: string; short: number }) => `${p.slot} is about ${p.short} servings short.`,
    DOUBLED: (p: { slot: string; swapTo?: string }) =>
      p.swapTo ? `${p.slot} is covered twice and ${p.swapTo.toLowerCase()} is still open.` : `${p.slot} is covered twice.`,
    DIET_UNCOVERED: (p: { diet: Diet; category: Category }) => `No ${p.diet} ${categoryWord[p.category]} yet.`,
    ALLERGEN_CONFLICT: (p: { item: string; allergen: Allergen }) =>
      `${p.item} has ${allergenWord[p.allergen]}. It needs a label and its own plate.`,
    ALLERGEN_NO_SAFE_OPTION: (p: { allergen: Allergen; category: Category }) =>
      `Every ${categoryWord[p.category]} so far has ${allergenWord[p.allergen]}.`,
    OVEN_CONFLICT_LONG: (p: { item: string; minutes: number; window: number }) =>
      `${p.item} needs ${p.minutes} oven minutes and the rewarm window is ${p.window}.`,
    OVEN_CONFLICT_FULL: (p: { item: string }) => `No rack space left for ${p.item.toLowerCase()} in the rewarm window.`,
    TENTATIVE: (p: { item: string; handle: string }) => `${p.item} for @${p.handle} isn't confirmed yet.`,
  } satisfies Partial<Record<GapKind | 'OVEN_CONFLICT_LONG' | 'OVEN_CONFLICT_FULL', unknown>>,

  activity: {
    created: (host: string) => `${host} started the plan`,
    claimed: (h: string, item: string) => `${h} took ${item.toLowerCase()}`,
    released: (h: string, item: string) => `${h} dropped ${item.toLowerCase()}`,
    updated: (h: string, item: string) => `${h} updated ${item.toLowerCase()}`,
    guest: (h: string) => `${h} pulled up a chair`,
    details: 'Plan details updated',
    headcount: (n: number) => `Headcount is now ${n}`,
    skipped: (slot: string) => `${slot} is off the menu`,
    unskipped: (slot: string) => `${slot} is back on the menu`,
    locked: 'Plan locked',
    unlocked: 'Plan reopened',
  },

  did: {
    created: (title: string) => `Started ${title}.`,
    claimed: (item: string, h: string) => `Recorded ${item} for ${h}.`,
    released: (item: string) => `Released ${item}.`,
    updated: (item: string) => `Updated ${item}.`,
    guest: (h: string) => `Saved ${h}'s details.`,
    details: 'Updated plan details.',
    skipped: (slot: string) => `Skipped ${slot}.`,
    unskipped: (slot: string) => `Put ${slot} back on the menu.`,
    locked: 'Locked the plan.',
    unlocked: 'Reopened the plan.',
  },

  cli: {
    readonly: 'Sous-chef can read the plan but only Gobble can change it.',
    noEvent: 'No potluck yet. Run ./gobble init first.',
    locked: 'The plan is locked. Ask the host to reopen it.',
  },

  landing: {
    metaTitle: 'Gobble · potluck planning in your group chat',
    metaDescription:
      'Gobble is a Switch agent that keeps your potluck list in the group chat and asks the right person about every gap until each dish has an owner.',
    h1: 'Every dish gets an owner.',
    lede:
      "Gobble sits in your group chat while everyone says what they're bringing. It keeps the list, spots the third pie and the missing gravy, and asks the right person to fill the gap.",
    ctaPrimary: 'See a live board',
    ctaSecondary: 'Run it yourself',
    howTitle: 'How a plan comes together',
    how: [
      { title: 'The host posts the basics.', body: "Headcount, day, dinner time, and what they've got covered." },
      { title: 'Guests answer like normal people.', body: '"Pecan pie from me." "We can do drinks." No forms and no app to install.' },
      { title: 'Gobble works the gaps.', body: 'It checks every claim against the headcount, diets, allergies and the oven, then asks one specific person about the most important gap.' },
      { title: 'Everyone gets the final list.', body: "When nothing is missing, Gobble posts who's bringing what and locks the plan." },
    ],
    catchesTitle: 'What it catches',
    catches: [
      'Nobody bringing gravy',
      'Two mashed potatoes and no green beans',
      'A vegetarian with nothing to eat but rolls',
      'Pecan pie at a table with a tree-nut allergy',
      "A casserole that needs the oven while the turkey's in it",
      'Fifteen guests and one pie',
    ],
    switchTitle: 'Built on Switch',
    switchBody:
      'Gobble is an agent in a Switch room, so it works in the chat your family already uses: Mattermost, Slack, Teams, Discord or Telegram. A deterministic engine does the counting, which means the plan always adds up.',
    footer: 'Built by Rofy for the Flip the Switch hackathon. Open source on GitHub.',
  },
};
