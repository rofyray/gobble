import { copy } from '../copy';
import { CATEGORY_ORDER } from './menu-thanksgiving';
import { monthDay, to12h, weekday } from './time';
import type { Claim, PotluckEvent, Report, SlotView } from './types';
import { allergensIn } from './vocab';

function tagNote(claim: Claim): string {
  if (claim.labeled) {
    const a = allergensIn(claim.tags)[0];
    return a ? ` · labeled, contains ${copy.words.allergenWord[a]}` : ' · labeled';
  }
  if (claim.tags.includes('vegan')) return ' · vegan';
  if (claim.tags.includes('vegetarian')) return ' · vegetarian';
  return '';
}

function claimLine(slot: SlotView, claim: Claim): string {
  const same = claim.item.trim().toLowerCase() === slot.label.trim().toLowerCase();
  const what = same ? claim.item : `${slot.label}: ${claim.item}`;
  return `- ${what} (@${claim.handle})${tagNote(claim)}`;
}

function ovenLine(report: Report): string {
  const { turkey, rewarm } = report.oven;
  const items = rewarm.map((r) => `${r.item} (@${r.handle})`).join(', ');
  if (turkey) {
    const base = `- Turkey ${to12h(turkey.start)} to ${to12h(turkey.end)}`;
    return items ? `${base}, then rewarm: ${items}` : base;
  }
  return items ? `- Rewarm: ${items}` : `- ${copy.board.pass.ovenFree}`;
}

/** Section 10.2. */
export function finalCard(event: PotluckEvent, report: Report, boardUrl: string): string {
  const lines: string[] = [
    `🦃 ORDER UP · ${event.title}`,
    `${weekday(event.date)} ${monthDay(event.date)} · dinner ${to12h(event.dinnerTime)} · ${event.headcount} guests`,
    '',
  ];
  for (const category of CATEGORY_ORDER) {
    const slots = report.slots.filter((s) => s.category === category && s.status !== 'skipped' && s.claims.length > 0);
    if (slots.length === 0) continue;
    lines.push(copy.board.categories[category]);
    for (const slot of slots) for (const claim of slot.claims) lines.push(claimLine(slot, claim));
  }
  lines.push('', 'OVEN', ovenLine(report), '', `Board: ${boardUrl}`);
  return lines.join('\n');
}
