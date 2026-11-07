import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/engine';
import { demo } from '@/lib/engine/fixtures/demo';
import { claimId, ids, newEvent, run } from './helpers';

const REQUIRED_DEFAULT = [
  'turkey', 'stuffing', 'mashed-potatoes', 'gravy', 'cranberry-sauce', 'green-veg', 'rolls', 'dessert', 'drinks-na', 'ice',
  'plates-cutlery',
];

describe('slot gaps', () => {
  it('E1: a new event has 11 unclaimed required slots and asks about turkey first', () => {
    const report = buildReport(newEvent());
    const unclaimed = report.gaps.filter((g) => g.kind === 'UNCLAIMED_REQUIRED');
    expect(unclaimed).toHaveLength(11);
    expect(unclaimed.map((g) => g.slotId).sort()).toEqual([...REQUIRED_DEFAULT].sort());
    expect(report.slots.find((s) => s.id === 'veg-main')!.required).toBe(false);
    expect(report.next?.slotId).toBe('turkey');
  });

  it('E2: a vegetarian guest makes veg-main required without a separate diet gap', () => {
    const r = run(newEvent(), { op: 'guest', handle: 'tayo', diets: ['vegetarian'] });
    expect(r.report.slots.find((s) => s.id === 'veg-main')!.required).toBe(true);
    expect(ids(r)).toContain('UNCLAIMED_REQUIRED:veg-main');
    expect(ids(r)).not.toContain('DIET_UNCOVERED:vegetarian:main');
  });

  it('E3: host turkey claim defaults to headcount servings', () => {
    const r = run(newEvent(), { op: 'claim', handle: 'rofy', slotId: 'turkey', item: 'Turkey' });
    const turkey = r.report.slots.find((s) => s.id === 'turkey')!;
    expect(turkey.status).toBe('owned');
    expect(turkey.have).toBe(15);
  });

  it('E4: one 8-serving dessert for 15 is 7 short', () => {
    const r = run(newEvent(), { op: 'claim', handle: 'kunda', slotId: 'dessert', item: 'Pumpkin pie' });
    const gap = r.report.gaps.find((g) => g.id === 'SHORTFALL:dessert');
    expect(gap?.numbers?.short).toBe(7);
    expect(gap?.severity).toBe('blocking');
  });

  it('E5: two 8-serving desserts cover 15 and are not a double', () => {
    const r = run(newEvent(),
      { op: 'claim', handle: 'kunda', slotId: 'dessert', item: 'Pumpkin pie' },
      { op: 'claim', handle: 'kia', slotId: 'dessert', item: 'Pecan pie' });
    expect(r.report.slots.find((s) => s.id === 'dessert')!.status).toBe('owned');
    expect(ids(r)).not.toContain('DOUBLED:dessert');
    expect(ids(r)).not.toContain('SHORTFALL:dessert');
  });

  it('E6: two 10-serving mashed potatoes is a double of the later claim, with the next open slot as swap', () => {
    const r = run(newEvent(),
      { op: 'claim', handle: 'kia', slotId: 'mashed-potatoes', item: 'Mashed potatoes' },
      { op: 'claim', handle: 'kunda', slotId: 'mashed-potatoes', item: 'Mashed potatoes' });
    const gap = r.report.gaps.find((g) => g.id === 'DOUBLED:mashed-potatoes')!;
    expect(gap.severity).toBe('warning');
    expect(gap.claimIds).toEqual([claimId(r, 'kunda', 'mashed-potatoes')]);
    expect(gap.swapTo).toBe('gravy');
    expect(gap.askHandles[0]).toBe('kunda');
  });

  it('E13: raising headcount to 25 makes 10-serving sides short', () => {
    const r = run(newEvent(),
      { op: 'claim', handle: 'kia', slotId: 'stuffing', item: 'Stuffing' },
      { op: 'set_details', headcount: 25 });
    expect(r.report.slots.find((s) => s.id === 'stuffing')!.needed).toBe(15);
    expect(r.report.gaps.find((g) => g.id === 'SHORTFALL:stuffing')?.numbers?.short).toBe(5);
  });

  it('E14: a skipped slot is not required and has no gap', () => {
    const r = run(newEvent(), { op: 'skip', slotId: 'green-veg' });
    const slot = r.report.slots.find((s) => s.id === 'green-veg')!;
    expect(slot.required).toBe(false);
    expect(slot.status).toBe('skipped');
    expect(ids(r).some((id) => id.endsWith(':green-veg'))).toBe(false);
  });

  it('E15: an off-menu dish gets a custom slot that never blocks', () => {
    const r = run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'new', item: 'Jollof rice', category: 'side' });
    const slot = r.event.slots.find((s) => s.id === 'custom-jollof-rice')!;
    expect(slot).toMatchObject({ custom: true, required: 'never', perGuest: 0, category: 'side', order: 1001 });
    expect(r.report.gaps.some((g) => g.slotId === 'custom-jollof-rice')).toBe(false);
    expect(r.report.slots.find((s) => s.id === 'custom-jollof-rice')!.status).toBe('owned');
  });

  it('flags tentative claims as warnings for the owner', () => {
    const r = run(newEvent(), { op: 'claim', handle: 'cee', slotId: 'stuffing', item: 'Stuffing', tentative: true });
    const gap = r.report.gaps.find((g) => g.kind === 'TENTATIVE')!;
    expect(gap.askHandles).toEqual(['cee']);
    expect(gap.severity).toBe('warning');
  });
});

describe('allergens', () => {
  const withPecan = () => run(newEvent(),
    { op: 'guest', handle: 'cee', allergies: ['tree-nuts'] },
    { op: 'claim', handle: 'kia', slotId: 'dessert', item: 'Pecan pie', tags: ['contains-tree-nuts'] });

  it('E7: pecan pie at a table with a tree-nut allergy is the next blocking gap', () => {
    const r = withPecan();
    const gap = r.report.next!;
    expect(gap.kind).toBe('ALLERGEN_CONFLICT');
    expect(gap.severity).toBe('blocking');
    expect(gap.allergen).toBe('tree-nuts');
    expect(gap.askHandles[0]).toBe('kia');
  });

  it('E8: labeled pecan pie plus a nut-free dessert clears allergen gaps', () => {
    const base = withPecan();
    const r = run(base.event,
      { op: 'update_claim', claimId: claimId(base, 'kia', 'dessert'), labeled: true },
      { op: 'claim', handle: 'kunda', slotId: 'dessert', item: 'Pumpkin pie' });
    expect(r.report.gaps.some((g) => g.kind.startsWith('ALLERGEN'))).toBe(false);
  });

  it('E9: a labeled nut dessert as the only dessert leaves no safe option', () => {
    const base = withPecan();
    const r = run(base.event, { op: 'update_claim', claimId: claimId(base, 'kia', 'dessert'), labeled: true });
    expect(ids(r)).toContain('ALLERGEN_NO_SAFE_OPTION:tree-nuts:dessert');
    expect(ids(r)).not.toContain(`ALLERGEN_CONFLICT:${claimId(base, 'kia', 'dessert')}`);
  });

  it('asks a second dessert owner alongside the flagged one', () => {
    const r = run(withPecan().event, { op: 'claim', handle: 'kunda', slotId: 'dessert', item: 'Pumpkin pie' });
    expect(r.report.gaps.find((g) => g.kind === 'ALLERGEN_CONFLICT')!.askHandles).toEqual(['kia', 'kunda']);
  });
});

describe('diet coverage', () => {
  it('a vegan guest with only a vegetarian main needs a vegan main and dessert', () => {
    const r = run(newEvent(),
      { op: 'guest', handle: 'tayo', diets: ['vegan'] },
      { op: 'claim', handle: 'tayo', slotId: 'veg-main', item: 'Mushroom wellington' });
    expect(ids(r)).toContain('DIET_UNCOVERED:vegan:main');
    expect(ids(r)).toContain('DIET_UNCOVERED:vegan:dessert');
  });

  it('a gluten-free dessert covers a gluten-free guest', () => {
    const r = run(newEvent(),
      { op: 'guest', handle: 'kia', diets: ['gluten-free'] },
      { op: 'claim', handle: 'kia', slotId: 'dessert', item: 'Flourless cake', tags: ['gluten-free'] });
    expect(ids(r)).not.toContain('DIET_UNCOVERED:gluten-free:dessert');
  });
});

describe('oven', () => {
  const turkeyAnd = (...oven: number[]) => run(newEvent(),
    { op: 'claim', handle: 'rofy', slotId: 'turkey', item: 'Turkey', ovenMinutes: 240 },
    ...oven.map((m, i) => ({ op: 'claim' as const, handle: `g${i}`, slotId: 'new', item: `Dish ${i}`, category: 'side' as const, ovenMinutes: m })));

  it('E10: a 40-minute dish clashes with a 30-minute rewarm window', () => {
    const r = turkeyAnd(40);
    expect(r.report.oven.turkey).toMatchObject({ start: '11:30', end: '15:30' });
    expect(r.report.oven.window).toEqual({ start: '15:30', end: '16:00' });
    const gap = r.report.gaps.find((g) => g.kind === 'OVEN_CONFLICT')!;
    expect(gap.severity).toBe('blocking');
    expect(gap.numbers).toEqual({ minutes: 40, window: 30, until: '15:30' });
  });

  it('E11: the fourth 10-minute dish has no rack space', () => {
    const r = turkeyAnd(10, 10, 10, 10);
    const conflicts = r.report.gaps.filter((g) => g.kind === 'OVEN_CONFLICT');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].askHandles).toEqual(['g3']);
    expect(r.report.oven.rewarm).toHaveLength(3);
  });

  it('E12: two ovens remove the clash', () => {
    const r = run(turkeyAnd(40).event, { op: 'set_details', ovens: 2 });
    expect(r.report.gaps.some((g) => g.kind === 'OVEN_CONFLICT')).toBe(false);
    expect(r.report.oven.rewarm).toHaveLength(1);
  });

  it('no turkey in the oven means no clash', () => {
    const r = run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'new', item: 'Casserole', category: 'side', ovenMinutes: 90 });
    expect(r.report.gaps.some((g) => g.kind === 'OVEN_CONFLICT')).toBe(false);
  });
});

describe('plan level', () => {
  it('E16: the full demo script ends complete and ready', () => {
    const report = buildReport(demo);
    expect(report.gaps).toEqual([]);
    expect(report.complete).toBe(true);
    expect(report.ready).toBe(true);
    expect(demo.status).toBe('locked');
  });

  it('E17: a claim that creates a double reports only that gap as fresh', () => {
    const base = run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'mashed-potatoes', item: 'Mashed potatoes' });
    const r = run(base.event, { op: 'claim', handle: 'kunda', slotId: 'mashed-potatoes', item: 'Mashed potatoes' });
    expect(r.fresh.map((g) => g.id)).toEqual(['DOUBLED:mashed-potatoes']);
  });

  it('E18: the report is deterministic', () => {
    const first = buildReport(demo);
    for (let i = 0; i < 100; i++) expect(buildReport(structuredClone(demo))).toEqual(first);
  });

  it('priority puts an open main before diets and sides', () => {
    const r = run(newEvent(), { op: 'guest', handle: 'tayo', diets: ['vegetarian'] });
    expect(r.report.gaps.slice(0, 2).map((g) => g.id)).toEqual(['UNCLAIMED_REQUIRED:turkey', 'UNCLAIMED_REQUIRED:veg-main']);
  });

  it('aggregates diets and allergies without names', () => {
    expect(buildReport(demo).table).toEqual({ diets: { vegetarian: 1 }, allergies: { 'tree-nuts': 1 } });
  });
});
