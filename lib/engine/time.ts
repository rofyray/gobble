// HH:MM (24h) and YYYY-MM-DD helpers. Pure: dates are parsed as UTC calendar days.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const day = 24 * 60;
  const t = ((total % day) + day) % day;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(hhmm: string, delta: number): string {
  return fromMinutes(toMinutes(hhmm) + delta);
}

/** '15:30' -> '3:30 PM' */
export function to12h(hhmm: string): string {
  const t = toMinutes(hhmm);
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** '15:30' -> '3:30' (no suffix, for tight spaces like the oven strip) */
export function to12hShort(hhmm: string): string {
  return to12h(hhmm).replace(/ (AM|PM)$/, '');
}

function parseDate(ymd: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

/** '2026-11-26' -> 'Thursday' */
export function weekday(ymd: string): string {
  return WEEKDAYS[parseDate(ymd).getUTCDay()];
}

/** '2026-11-26' -> 'Nov 26' */
export function monthDay(ymd: string): string {
  const d = parseDate(ymd);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const isYMD = (s: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
