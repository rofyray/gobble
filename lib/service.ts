// The plan service: engine + store. Used by the API routes and by the CLI in local mode.
import { customAlphabet } from 'nanoid';
import { applyOp, buildReport, createEvent, GobbleError } from './engine';
import type { IdGen, OpResult, PotluckEvent, Report } from './engine';
import { FIXTURES } from './engine/fixtures/demo';
import type { CreateInput, Op } from './schema';
import type { Store } from './store';

const alnum = '0123456789abcdefghijklmnopqrstuvwxyz';
const slugId = customAlphabet(alnum, 10);
const claimSuffix = customAlphabet(alnum, 6);

export const newClaimId: IdGen = (event) => {
  for (;;) {
    const id = `c_${claimSuffix()}`;
    if (!event.claims.some((c) => c.id === id)) return id;
  }
};

export const isFixture = (slug: string) => Object.hasOwn(FIXTURES, slug);

export interface Plan { event: PotluckEvent; report: Report }

export class PlanService {
  constructor(private store: Store, private clock: () => string = () => new Date().toISOString()) {}

  get storeKind() {
    return this.store.kind;
  }

  async create(input: CreateInput): Promise<Plan & { did: string }> {
    let slug = slugId();
    while (isFixture(slug) || (await this.store.get(slug))) slug = slugId();
    const created = createEvent(input, this.clock(), slug);
    await this.store.put(created.event);
    return created;
  }

  async get(slug: string): Promise<Plan> {
    const event = isFixture(slug) ? FIXTURES[slug] : await this.store.get(slug);
    if (!event) throw new GobbleError('NOT_FOUND', `No potluck "${slug}".`);
    return { event, report: buildReport(event) };
  }

  /** Read, apply, write. Single writer, so last write wins. */
  async op(slug: string, op: Op): Promise<OpResult> {
    if (isFixture(slug)) throw new GobbleError('LOCKED', 'The demo boards are read-only.');
    const { event } = await this.get(slug);
    const result = applyOp(event, op, this.clock(), newClaimId);
    await this.store.put(result.event);
    return result;
  }
}

export const boardUrlFor = (base: string, slug: string) => `${base.replace(/\/+$/, '')}/e/${slug}`;
