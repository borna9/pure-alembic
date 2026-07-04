// Pure date arithmetic on YYYY-MM-DD strings. Parsed as plain calendar
// dates (no timezone), so results are identical on every device.

import type { ISODate } from '../domain/types';

export function parseISODate(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function toISODate(y: number, m: number, d: number): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  return Date.UTC(y, m - 1, d);
}

const MS_PER_DAY = 86_400_000;

export function addDays(date: ISODate, days: number): ISODate {
  const t = new Date(toUTC(date) + days * MS_PER_DAY);
  return toISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from a to b (positive when b is after a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every date from start to end, inclusive. Empty if end precedes start. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; compareDates(d, end) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: ISODate): number {
  return new Date(toUTC(date)).getUTCDay();
}

export function dayOfMonth(date: ISODate): number {
  return parseISODate(date).d;
}

export function isWithin(date: ISODate, start: ISODate, end: ISODate): boolean {
  return compareDates(date, start) >= 0 && compareDates(date, end) <= 0;
}
