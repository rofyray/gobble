import { copy } from '@/lib/copy';
import type { SlotStatus, SlotView } from '@/lib/engine/types';
import { ClaimLine } from './ClaimLine';
import { Stamp, stampText } from './Stamp';

export interface TicketMarks {
  flagged: Set<string>;
  doubled: Set<string>;
  oven: Set<string>;
}

export const NO_MARKS: TicketMarks = { flagged: new Set(), doubled: new Set(), oven: new Set() };

function short(slot: SlotView) {
  return Math.max(0, slot.needed - slot.have);
}

/** Status words for the ticket's accessible name, from the stamp copy. */
export function statusWords(status: SlotStatus, n?: number): string {
  return stampText(status, n).toLowerCase();
}

export function Ticket({
  slot, index, changed = false, marks = NO_MARKS, freshClaims,
}: {
  slot: SlotView;
  index: number;
  changed?: boolean;
  marks?: TicketMarks;
  freshClaims?: Set<string>;
}) {
  const s = slot.status;
  return (
    <div className="ticket-hang">
      <span className="ticket-clip" aria-hidden />
      <article
        className={`ticket${s === 'optional' ? ' is-optional' : ''}`}
        aria-label={`${slot.label}, ${statusWords(s, short(slot))}`}
      >
        <div className="ticket-no">{copy.board.ticketNo(index)}</div>
        <h3 className="ticket-label">{slot.label}</h3>
        {slot.claims.length > 0 ? (
          <ul className="claims">
            {slot.claims.map((c) => (
              <ClaimLine
                key={c.id}
                claim={c}
                flagged={marks.flagged.has(c.id)}
                doubled={marks.doubled.has(c.id)}
                ovenClash={marks.oven.has(c.id)}
                fresh={freshClaims?.has(c.id)}
              />
            ))}
          </ul>
        ) : s === 'open' ? (
          <div aria-hidden>
            <div className="claim-empty" />
            <div className="claim-empty" />
          </div>
        ) : null}
        {slot.needed > 0 && (
          <div className={`servings${s === 'short' ? ' is-short' : ''}`}>{copy.board.servings(slot.have, slot.needed)}</div>
        )}
        <Stamp key={s} status={s} n={short(slot)} animate={changed} />
      </article>
    </div>
  );
}
