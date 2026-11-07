import { applyOp, buildReport, createEvent } from '@/lib/engine';
import type { OpResult, PotluckEvent } from '@/lib/engine';
import type { Op } from '@/lib/schema';

let tick = 0;
export const now = () => new Date(Date.UTC(2026, 10, 20, 12, 0, 0) + tick++ * 60_000).toISOString();

export function newEvent(headcount = 15, extra: Partial<{ ovens: number }> = {}): PotluckEvent {
  return createEvent(
    { title: 'Test', date: '2026-11-26', dinnerTime: '16:00', headcount, host: 'rofy', ...extra },
    now(),
    'testslug01',
  ).event;
}

/** Applies ops in order and returns the last result. */
export function run(event: PotluckEvent, ...ops: Op[]): OpResult {
  let result: OpResult = { event, report: buildReport(event), fresh: [], did: '' };
  for (const op of ops) result = applyOp(result.event, op, now());
  return result;
}

export const ids = (r: OpResult) => r.report.gaps.map((g) => g.id);
export const claimId = (r: OpResult, handle: string, slotId: string) =>
  r.event.claims.find((c) => c.handle === handle && c.slotId === slotId)!.id;
