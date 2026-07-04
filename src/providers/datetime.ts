// Provider-side date/time helpers.

import { minutesToTime, timeToMinutes } from '../logic/firstAvailable';

/** End = start + hours (FR-26), capped at 23:59 to stay on the same day. */
export function endTimeFrom(startTime: string, hours: number): string {
  const end = timeToMinutes(startTime) + Math.round(hours * 60);
  return end >= 24 * 60 ? '23:59' : minutesToTime(end);
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** JS Date at a local wall-clock time on a calendar day. */
export function toLocalDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** ICS UTC timestamp, e.g. 20260704T130000Z. */
export function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
