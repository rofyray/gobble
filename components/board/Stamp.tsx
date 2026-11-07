import { copy } from '@/lib/copy';
import type { SlotStatus } from '@/lib/engine/types';

export function stampText(status: SlotStatus, n = 0): string {
  const stamps = copy.board.stamps;
  switch (status) {
    case 'short': return stamps.short(n);
    case 'skipped': return '';
    default: return stamps[status];
  }
}

export function Stamp({ status, n, animate = false }: { status: SlotStatus; n?: number; animate?: boolean }) {
  if (status === 'skipped') return null;
  return (
    <span className={`stamp stamp-${status}${animate ? ' stamp-enter' : ''}`} aria-hidden>
      {stampText(status, n)}
    </span>
  );
}
