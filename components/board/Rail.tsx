import { copy } from '@/lib/copy';
import type { Category, SlotView } from '@/lib/engine/types';
import { Ticket, type TicketMarks } from './Ticket';

export function Rail({
  category, slots, numberOf, changed, marks, freshClaims,
}: {
  category: Category;
  slots: SlotView[];
  numberOf: (slotId: string) => number;
  changed?: Set<string>;
  marks?: TicketMarks;
  freshClaims?: Set<string>;
}) {
  const visible = slots.filter((s) => s.status !== 'skipped');
  if (visible.length === 0) return null;
  const id = `rail-${category}`;
  const owned = visible.filter((s) => s.claims.length > 0).length;
  return (
    <section className="rail" aria-labelledby={id}>
      <div className="rail-head">
        <h2 id={id} className="rail-label">{copy.board.categories[category]}</h2>
        <span className="rail-count">{copy.board.pass.owned(owned, visible.length)}</span>
      </div>
      <div className="rail-bar" aria-hidden />
      <ul className="rail-tickets">
        {visible.map((slot) => (
          <li key={slot.id}>
            <Ticket
              slot={slot}
              index={numberOf(slot.id)}
              changed={changed?.has(slot.id)}
              marks={marks}
              freshClaims={freshClaims}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
