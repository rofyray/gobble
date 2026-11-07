import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '@/cli/run';

const repoRoot = path.resolve(__dirname, '../..');
let dir: string;
let env: Record<string, string>;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'gobble-cli-'));
  env = { GOBBLE_DATA_DIR: dir, GOBBLE_BOARD_URL: 'http://localhost:3000' };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

type View = {
  ok: boolean;
  did?: string;
  complete: boolean;
  ready: boolean;
  next: { id: string; kind: string; askHandles: string[]; swapTo?: string } | null;
  fresh: { id: string; kind: string; askHandles: string[] }[];
  claims: { id: string; slot: string; handle: string; item: string; tags: string[]; labeled: boolean }[];
  error?: { code: string; message: string };
  card?: string;
};

async function gobble(line: string, extraEnv: Record<string, string> = {}): Promise<View> {
  const argv = line.match(/"[^"]*"|\S+/g)!.map((a) => a.replace(/^"|"$/g, ''));
  const r = await runCli(argv, { repoRoot, env: { ...env, ...extraEnv } });
  expect(r.code).toBe(r.out.ok ? 0 : 1);
  return r.out as unknown as View;
}

const claimOf = (v: View, handle: string, slot: string) => v.claims.find((c) => c.handle === handle && c.slot === slot)!.id;

describe('Section 17 script through the CLI', () => {
  it('ends ready with the expected final card', async () => {
    // 1. rofy sets up
    let v = await gobble(`init --title "Thanksgiving at Rofy's" --date 2026-11-26 --dinner 16:00 --headcount 15 --host @Rofy --turkey-minutes 240`);
    expect(v.ok).toBe(true);
    await gobble('guest rofy --name Rofy');
    await gobble('claim rofy turkey --item Turkey --oven 240');
    await gobble('claim rofy gravy --item Gravy');
    await gobble('claim rofy cranberry-sauce --item "Cranberry sauce"');
    await gobble('claim rofy plates-cutlery --item "Plates and cutlery"');
    v = await gobble('claim rofy ice --item Ice');
    expect(v.next?.id).toBe('UNCLAIMED_REQUIRED:stuffing');

    // 2. tayo: vegetarian wellington needing 40 oven minutes
    await gobble('guest tayo --diet vegetarian');
    v = await gobble('claim tayo veg-main --item "Mushroom wellington" --oven 40');
    expect(v.fresh.map((g) => g.kind)).toEqual(['OVEN_CONFLICT']);
    expect(v.fresh[0].askHandles).toEqual(['tayo']);

    // 3. tayo bakes at home
    v = await gobble(`update ${claimOf(v, 'tayo', 'veg-main')} --oven 0`);
    expect(v.fresh).toEqual([]);
    expect(v.next?.id).toBe('UNCLAIMED_REQUIRED:stuffing');
    expect(v.next?.askHandles).toEqual(['tayo']);

    // 4. kunda: vague dessert
    v = await gobble('claim kunda dessert --item "Dessert (type TBD)"');
    expect(v.fresh.map((g) => g.id)).toEqual(['SHORTFALL:dessert']);

    // 5. kia: pecan pie and mashed potatoes
    await gobble('claim kia dessert --item "Pecan pie" --tags contains-tree-nuts');
    v = await gobble('claim kia mashed-potatoes --item "Mashed potatoes"');

    // 6. cee: tree-nut allergy, drinks
    await gobble('guest cee --allergy tree-nuts');
    v = await gobble('claim cee drinks-na --item Drinks');
    expect(v.next?.kind).toBe('ALLERGEN_CONFLICT');
    expect(v.next?.askHandles).toEqual(['kia', 'kunda']);

    // 7. kia labels it
    v = await gobble(`update ${claimOf(v, 'kia', 'dessert')} --labeled`);
    expect(v.next?.kind).not.toBe('ALLERGEN_CONFLICT');

    // 8. kunda: pumpkin pie, plus a second mashed potatoes
    await gobble(`update ${claimOf(v, 'kunda', 'dessert')} --item "Pumpkin pie"`);
    v = await gobble('claim kunda mashed-potatoes --item "Mashed potatoes"');
    expect(v.fresh.map((g) => g.id)).toEqual(['DOUBLED:mashed-potatoes']);

    // 9. kunda switches to green beans
    v = await gobble(`update ${claimOf(v, 'kunda', 'mashed-potatoes')} --slot green-veg --item "Green beans"`);

    // 10, 11
    await gobble('claim cee stuffing --item Stuffing');
    v = await gobble('claim tayo rolls --item Rolls');
    expect(v.complete).toBe(true);
    expect(v.ready).toBe(true);
    expect(v.next).toBeNull();

    const status = await gobble('status');
    expect(status.ready).toBe(true);

    const final = await gobble('final');
    expect(final.card!.replace(/\/e\/[a-z0-9]+/, '/e/<slug>')).toMatchSnapshot();

    // 12. lock
    v = await gobble('lock');
    expect(v.did).toBe('Locked the plan.');
    const locked = await gobble('claim kia dessert --item "Apple pie"');
    expect(locked.error?.code).toBe('LOCKED');
  });
});

describe('CLI guards', () => {
  it('reports a missing event', async () => {
    const v = await gobble('status');
    expect(v.error).toEqual({ code: 'NO_EVENT', message: 'No potluck yet. Run ./gobble init first.' });
  });

  it('refuses mutations in read-only mode but allows reads', async () => {
    await gobble('init --title T --date 2026-11-26 --dinner 16:00 --headcount 8 --host rofy');
    const blocked = await gobble('claim kia dessert --item Pie', { GOBBLE_READONLY: '1' });
    expect(blocked.error?.code).toBe('READONLY');
    expect((await gobble('status', { GOBBLE_READONLY: '1' })).ok).toBe(true);
    expect((await gobble('final', { GOBBLE_READONLY: '1' })).ok).toBe(true);
  });

  it('rejects bad input with INVALID and unknown slots with UNKNOWN_SLOT', async () => {
    await gobble('init --title T --date 2026-11-26 --dinner 16:00 --headcount 8 --host rofy');
    expect((await gobble('claim kia dessert')).error?.code).toBe('INVALID');
    expect((await gobble('claim kia pizza --item Pizza')).error?.code).toBe('UNKNOWN_SLOT');
    expect((await gobble('details --headcount lots')).error?.code).toBe('INVALID');
    expect((await gobble('guest kia --diet carnivore')).error?.code).toBe('INVALID');
  });

  it('runs through the built binary and agent shim', () => {
    const shim = path.join(repoRoot, 'agents/gobble/gobble');
    const out = execFileSync(shim, ['slots'], { env: { ...process.env, ...env }, cwd: dir }).toString();
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(parsed.slots).toHaveLength(17);
  });
});
