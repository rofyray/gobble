// The gobble CLI: the agent's only tool. Section 10 of the spec.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { z } from 'zod';
import { copy } from '../lib/copy';
import { finalCard, GobbleError, THANKSGIVING_MENU } from '../lib/engine';
import type { Gap, OpResult, PotluckEvent, Report } from '../lib/engine';
import { createSchema, opSchema, zodMessage, type CreateInput, type Op } from '../lib/schema';
import { boardUrlFor, PlanService, type Plan } from '../lib/service';
import { fileStore, type Env } from '../lib/store';

export interface CliContext {
  repoRoot: string;
  env: Env;
}

export interface CliResult {
  code: number;
  out: Record<string, unknown>;
  pretty: boolean;
}

const READ_ONLY_COMMANDS = ['status', 'final', 'board', 'slots'];

// ---------- backends ----------

interface Backend {
  mode: 'local' | 'remote';
  create(input: CreateInput): Promise<Plan & { slug: string; boardUrl: string; did: string }>;
  get(slug: string): Promise<Plan>;
  op(slug: string, op: Op): Promise<OpResult>;
  boardUrl(slug: string): string;
}

function localBackend(ctx: CliContext): Backend {
  const service = new PlanService(fileStore(ctx.repoRoot, ctx.env));
  const base = ctx.env.GOBBLE_BOARD_URL || 'http://localhost:3000';
  return {
    mode: 'local',
    async create(input) {
      const r = await service.create(input);
      return { ...r, slug: r.event.slug, boardUrl: boardUrlFor(base, r.event.slug) };
    },
    get: (slug) => service.get(slug),
    op: (slug, op) => service.op(slug, op),
    boardUrl: (slug) => boardUrlFor(base, slug),
  };
}

function remoteBackend(ctx: CliContext, apiUrl: string): Backend {
  const base = apiUrl.replace(/\/+$/, '');
  const token = ctx.env.GOBBLE_AGENT_TOKEN ?? '';

  async function call<T>(method: 'GET' | 'POST', route: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new GobbleError('NETWORK', `Could not reach ${base}: ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => null)) as
      | ({ ok: true } & T)
      | { ok: false; error: { code: GobbleError['code']; message: string } }
      | null;
    if (!json) throw new GobbleError('NETWORK', `Bad response from ${base} (HTTP ${res.status}).`);
    if (!json.ok) throw new GobbleError(json.error.code, json.error.message);
    return json;
  }

  return {
    mode: 'remote',
    create: (input) => call('POST', '/api/events', input),
    get: (slug) => call('GET', `/api/events/${encodeURIComponent(slug)}`),
    op: (slug, op) => call('POST', `/api/events/${encodeURIComponent(slug)}/ops`, op),
    boardUrl: (slug) => boardUrlFor(base, slug),
  };
}

// ---------- current-event pointer ----------

function pointerFile(ctx: CliContext) {
  const dir = ctx.env.GOBBLE_DATA_DIR || path.join(ctx.repoRoot, '.gobble');
  return path.join(dir, 'current-event');
}

async function readPointer(ctx: CliContext): Promise<string | null> {
  try {
    return (await readFile(pointerFile(ctx), 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

async function writePointer(ctx: CliContext, slug: string) {
  const file = pointerFile(ctx);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${slug}\n`);
}

// ---------- agent view (10.1) ----------

function gapView(g: Gap) {
  return {
    id: g.id,
    kind: g.kind,
    ...(g.slotId ? { slotId: g.slotId } : {}),
    ...(g.claimIds ? { claimIds: g.claimIds } : {}),
    ...(g.diet ? { diet: g.diet } : {}),
    ...(g.allergen ? { allergen: g.allergen } : {}),
    ...(g.category ? { category: g.category } : {}),
    askHandles: g.askHandles,
    ...(g.swapTo ? { swapTo: g.swapTo } : {}),
    hint: g.hint,
    numbers: g.numbers ?? {},
  };
}

function agentView(event: PotluckEvent, report: Report, boardUrl: string, extra: { did?: string; fresh?: Gap[] }) {
  return {
    ok: true,
    ...(extra.did ? { did: extra.did } : {}),
    boardUrl,
    event: {
      title: event.title, date: event.date, dinnerTime: event.dinnerTime, headcount: event.headcount,
      ovens: event.ovens, status: event.status,
    },
    fresh: (extra.fresh ?? []).map(gapView),
    complete: report.complete,
    ready: report.ready,
    next: report.next ? gapView(report.next) : null,
    open: report.gaps.filter((g) => g.kind === 'UNCLAIMED_REQUIRED').map((g) => g.slotId),
    warnings: report.gaps.filter((g) => g.severity === 'warning').map((g) => g.id),
    claims: event.claims.map((c) => ({
      id: c.id, slot: c.slotId, handle: c.handle, item: c.item, servings: c.servings, tags: c.tags,
      oven: c.ovenMinutes, labeled: c.labeled, tentative: c.tentative,
    })),
    guests: event.guests.map((g) => ({ handle: g.handle, diets: g.diets, allergies: g.allergies, isHost: g.isHost })),
  };
}

// ---------- argument parsing ----------

type Options = NonNullable<ParseArgsConfig['options']>;
const str = { type: 'string' } as const;
const bool = { type: 'boolean' } as const;
const GLOBAL: Options = { pretty: bool, event: str };

const COMMAND_OPTIONS: Record<string, Options> = {
  init: { title: str, date: str, dinner: str, headcount: str, host: str, ovens: str, 'turkey-minutes': str },
  details: { title: str, date: str, dinner: str, headcount: str, ovens: str, 'turkey-minutes': str, 'rest-minutes': str },
  guest: { name: str, diet: str, allergy: str, host: bool },
  claim: { item: str, category: str, servings: str, tags: str, oven: str, tentative: bool },
  update: { item: str, slot: str, servings: str, tags: str, oven: str, labeled: bool, unlabeled: bool, confirm: bool },
  release: {}, skip: {}, unskip: {}, lock: {}, unlock: {}, status: {}, final: {}, board: {}, slots: {},
};

const USAGE = `Usage: gobble <command> [args] [--pretty]
Commands: ${Object.keys(COMMAND_OPTIONS).join(', ')}`;

function int(name: string, v: unknown): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new GobbleError('INVALID', `--${name} must be a whole number.`);
  return n;
}

/** "a,b" -> ['a','b']; "none" -> []. */
function list(v: unknown): string[] | undefined {
  if (typeof v !== 'string') return undefined;
  const items = v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return items.length === 1 && items[0] === 'none' ? [] : items;
}

function positional(args: string[], i: number, what: string): string {
  const v = args[i];
  if (!v) throw new GobbleError('INVALID', `Missing ${what}.`);
  return v;
}

function parseOp(raw: Record<string, unknown>): Op {
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const parsed = opSchema.safeParse(clean);
  if (!parsed.success) throw new GobbleError('INVALID', zodMessage(parsed.error));
  return parsed.data;
}

function buildOp(command: string, args: string[], o: Record<string, unknown>): Op {
  switch (command) {
    case 'details':
      return parseOp({
        op: 'set_details', title: o.title, date: o.date, dinnerTime: o.dinner, headcount: int('headcount', o.headcount),
        ovens: int('ovens', o.ovens), turkeyMinutes: int('turkey-minutes', o['turkey-minutes']),
        restMinutes: int('rest-minutes', o['rest-minutes']),
      });
    case 'guest':
      return parseOp({
        op: 'guest', handle: positional(args, 0, 'handle'), displayName: o.name, diets: list(o.diet),
        allergies: list(o.allergy), isHost: o.host ? true : undefined,
      });
    case 'claim':
      return parseOp({
        op: 'claim', handle: positional(args, 0, 'handle'), slotId: positional(args, 1, 'slot id (or new)'),
        item: o.item, category: o.category, servings: int('servings', o.servings), tags: list(o.tags),
        ovenMinutes: int('oven', o.oven), tentative: o.tentative ? true : undefined,
      });
    case 'update':
      return parseOp({
        op: 'update_claim', claimId: positional(args, 0, 'claim id'), item: o.item, slotId: o.slot,
        servings: int('servings', o.servings), tags: list(o.tags), ovenMinutes: int('oven', o.oven),
        labeled: o.labeled ? true : o.unlabeled ? false : undefined, tentative: o.confirm ? false : undefined,
      });
    case 'release':
      return parseOp({ op: 'release', claimId: positional(args, 0, 'claim id') });
    case 'skip':
    case 'unskip':
      return parseOp({ op: command, slotId: positional(args, 0, 'slot id') });
    case 'lock':
    case 'unlock':
      return parseOp({ op: command });
    default:
      throw new GobbleError('INVALID', USAGE);
  }
}

// ---------- main ----------

async function execute(argv: string[], ctx: CliContext): Promise<Record<string, unknown>> {
  const command = argv[0];
  if (!command || !(command in COMMAND_OPTIONS)) throw new GobbleError('INVALID', USAGE);

  let parsed;
  try {
    parsed = parseArgs({ args: argv.slice(1), options: { ...GLOBAL, ...COMMAND_OPTIONS[command] }, allowPositionals: true });
  } catch (err) {
    throw new GobbleError('INVALID', (err as Error).message);
  }
  const o = parsed.values as Record<string, unknown>;
  const args = parsed.positionals;

  if (ctx.env.GOBBLE_READONLY === '1' && !READ_ONLY_COMMANDS.includes(command)) {
    throw new GobbleError('READONLY', copy.cli.readonly);
  }

  const apiUrl = ctx.env.GOBBLE_API_URL?.trim();
  const backend = apiUrl ? remoteBackend(ctx, apiUrl) : localBackend(ctx);

  if (command === 'init') {
    const input = createSchema.safeParse({
      title: o.title, date: o.date, dinnerTime: o.dinner, headcount: int('headcount', o.headcount),
      host: o.host, ovens: int('ovens', o.ovens), turkeyMinutes: int('turkey-minutes', o['turkey-minutes']),
    });
    if (!input.success) throw new GobbleError('INVALID', zodMessage(input.error));
    const created = await backend.create(input.data);
    await writePointer(ctx, created.slug);
    return agentView(created.event, created.report, created.boardUrl, { did: created.did });
  }

  const slug = (typeof o.event === 'string' && o.event) || (await readPointer(ctx));

  if (command === 'slots') {
    const slots = slug
      ? (await backend.get(slug)).event.slots.filter((s) => !s.skipped)
      : THANKSGIVING_MENU;
    return { ok: true, slots: slots.map((s) => ({ id: s.id, label: s.label, category: s.category })) };
  }

  if (!slug) throw new GobbleError('NO_EVENT', copy.cli.noEvent);
  const boardUrl = backend.boardUrl(slug);

  switch (command) {
    case 'status': {
      const { event, report } = await backend.get(slug);
      return agentView(event, report, boardUrl, {});
    }
    case 'final': {
      const { event, report } = await backend.get(slug);
      return { ok: true, card: finalCard(event, report, boardUrl) };
    }
    case 'board':
      return { ok: true, boardUrl };
    default: {
      const result = await backend.op(slug, buildOp(command, args, o));
      return agentView(result.event, result.report, boardUrl, { did: result.did, fresh: result.fresh });
    }
  }
}

export async function runCli(argv: string[], ctx: CliContext): Promise<CliResult> {
  const pretty = argv.includes('--pretty');
  try {
    return { code: 0, out: await execute(argv, ctx), pretty };
  } catch (err) {
    if (err instanceof GobbleError) {
      return { code: 1, out: { ok: false, error: { code: err.code, message: err.message } }, pretty };
    }
    if (err instanceof z.ZodError) {
      return { code: 1, out: { ok: false, error: { code: 'INVALID', message: zodMessage(err) } }, pretty };
    }
    return { code: 1, out: { ok: false, error: { code: 'INTERNAL', message: (err as Error).message } }, pretty };
  }
}

export function format(result: CliResult): string {
  return result.pretty ? JSON.stringify(result.out, null, 2) : JSON.stringify(result.out);
}

/** Loads ./.env from the working directory when present. */
export function loadEnv(cwd: string) {
  const file = path.join(cwd, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

