import { describe, expect, it } from 'vitest';
import { addMinutes, applyOp, buildReport, finalCard, GobbleError, monthDay, to12h, weekday } from '@/lib/engine';
import { demo, demoMid } from '@/lib/engine/fixtures/demo';
import { claimId, newEvent, now, run } from './helpers';

describe('time', () => {
  it('does HH:MM math and formatting', () => {
    expect(addMinutes('16:00', -30)).toBe('15:30');
    expect(addMinutes('00:10', -20)).toBe('23:50');
    expect(to12h('15:30')).toBe('3:30 PM');
    expect(to12h('00:05')).toBe('12:05 AM');
    expect(to12h('12:00')).toBe('12:00 PM');
    expect(weekday('2026-11-26')).toBe('Thursday');
    expect(monthDay('2026-11-26')).toBe('Nov 26');
  });
});

describe('ops', () => {
  it('createEvent sets defaults and seats the host', () => {
    const e = newEvent();
    expect(e).toMatchObject({ ovens: 1, turkeyMinutes: 240, restMinutes: 30, status: 'collecting', version: 1 });
    expect(e.guests).toEqual([expect.objectContaining({ handle: 'rofy', isHost: true })]);
    expect(e.slots).toHaveLength(17);
  });

  it('claim applies defaults, implied tags and auto-creates the guest', () => {
    const r = run(newEvent(), { op: 'claim', handle: '@Kia', slotId: 'mac-and-cheese', item: 'Mac and cheese', tags: ['vegetarian'] });
    const c = r.event.claims[0];
    expect(c).toMatchObject({ handle: 'kia', servings: 10, ovenMinutes: 0, tentative: false, labeled: false });
    expect(c.tags).toEqual(['vegetarian', 'contains-dairy', 'contains-gluten']);
    expect(r.event.guests.map((g) => g.handle)).toContain('kia');
    expect(r.did).toBe('Recorded Mac and cheese for kia.');
    expect(r.event.activity.at(-1)?.text).toBe('kia took mac and cheese');
  });

  it('moving a claim re-applies implied tags and the new slot default', () => {
    const base = run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'mac-and-cheese', item: 'Mac and cheese' });
    const r = run(base.event, { op: 'update_claim', claimId: base.event.claims[0].id, slotId: 'green-veg', item: 'Green beans' });
    expect(r.event.claims[0]).toMatchObject({ slotId: 'green-veg', item: 'Green beans', tags: [], servings: 10 });
  });

  it('release removes the claim and reopens the slot', () => {
    const base = run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'gravy', item: 'Gravy' });
    const r = run(base.event, { op: 'release', claimId: claimId(base, 'kia', 'gravy') });
    expect(r.event.claims).toEqual([]);
    expect(r.fresh.map((g) => g.id)).toEqual(['UNCLAIMED_REQUIRED:gravy']);
  });

  it('confirming a tentative claim clears the warning', () => {
    const base = run(newEvent(), { op: 'claim', handle: 'cee', slotId: 'stuffing', item: 'Stuffing', tentative: true });
    const r = run(base.event, { op: 'update_claim', claimId: base.event.claims[0].id, tentative: false });
    expect(r.report.gaps.some((g) => g.kind === 'TENTATIVE')).toBe(false);
  });

  it('rejects unknown slots and claims', () => {
    expect(() => run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'pizza', item: 'Pizza' })).toThrow(GobbleError);
    expect(() => run(newEvent(), { op: 'release', claimId: 'c_nope00' })).toThrow(/No claim/);
    expect(() => run(newEvent(), { op: 'claim', handle: 'kia', slotId: 'new', item: 'Pizza' })).toThrow(/category/);
  });

  it('a locked plan rejects everything except unlock', () => {
    const locked = run(newEvent(), { op: 'lock' }).event;
    expect(() => applyOp(locked, { op: 'skip', slotId: 'ice' }, now())).toThrow(expect.objectContaining({ code: 'LOCKED' }));
    expect(applyOp(locked, { op: 'unlock' }, now()).event.status).toBe('collecting');
  });

  it('every op bumps version and appends one activity, capped at 50', () => {
    let e = newEvent();
    for (let i = 0; i < 60; i++) e = applyOp(e, { op: i % 2 ? 'skip' : 'unskip', slotId: 'ice' }, now()).event;
    expect(e.version).toBe(61);
    expect(e.activity).toHaveLength(50);
  });

  it('changing turkey minutes moves the turkey oven time', () => {
    const r = run(newEvent(),
      { op: 'claim', handle: 'rofy', slotId: 'turkey', item: 'Turkey', ovenMinutes: 240 },
      { op: 'set_details', turkeyMinutes: 300 });
    expect(r.report.oven.turkey).toMatchObject({ start: '10:30', end: '15:30' });
  });
});

describe('fixtures', () => {
  it('demoMid shows an open slot, a double, an allergen flag and an oven clash', () => {
    const statuses = buildReport(demoMid).slots.map((s) => s.status);
    for (const s of ['open', 'doubled', 'flagged', 'oven'] as const) expect(statuses).toContain(s);
  });
});

describe('final card', () => {
  it('matches the Section 10.2 format', () => {
    expect(finalCard(demo, buildReport(demo), 'http://localhost:3000/e/demo')).toBe(
      [
        "🦃 ORDER UP · Thanksgiving at Rofy's",
        'Thursday Nov 26 · dinner 4:00 PM · 15 guests',
        '',
        'MAINS',
        '- Turkey (@rofy)',
        '- Vegetarian main: Mushroom wellington (@tayo) · vegetarian',
        'SIDES',
        '- Stuffing (@cee)',
        '- Mashed potatoes (@kia)',
        '- Gravy (@rofy)',
        '- Cranberry sauce (@rofy)',
        '- Green vegetable: Green beans (@kunda)',
        'BREAD',
        '- Rolls (@tayo)',
        'DESSERT',
        '- Dessert: Pumpkin pie (@kunda)',
        '- Dessert: Pecan pie (@kia) · labeled, contains tree nuts',
        'DRINKS',
        '- Soft drinks: Drinks (@cee)',
        'SUPPLIES',
        '- Ice (@rofy)',
        '- Plates and cutlery (@rofy)',
        '',
        'OVEN',
        '- Turkey 11:30 AM to 3:30 PM',
        '',
        'Board: http://localhost:3000/e/demo',
      ].join('\n'),
    );
  });
});
