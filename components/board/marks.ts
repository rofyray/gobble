import type { Report } from '@/lib/engine/types';
import { CATEGORY_ORDER } from '@/lib/engine/menu-thanksgiving';
import type { TicketMarks } from './Ticket';

/** Which claims a ticket should mark as flagged, doubled or clashing with the oven. */
export function marksFrom(report: Report): TicketMarks {
  const marks: TicketMarks = { flagged: new Set(), doubled: new Set(), oven: new Set() };
  for (const g of report.gaps) {
    const target =
      g.kind === 'ALLERGEN_CONFLICT' ? marks.flagged : g.kind === 'DOUBLED' ? marks.doubled : g.kind === 'OVEN_CONFLICT' ? marks.oven : null;
    g.claimIds?.forEach((id) => target?.add(id));
  }
  return marks;
}

/** Visible slots in display order: category rails top to bottom, then slot order. */
export function displayOrder(report: Report): string[] {
  return CATEGORY_ORDER.flatMap((cat) =>
    report.slots.filter((s) => s.category === cat && s.status !== 'skipped').map((s) => s.id));
}
