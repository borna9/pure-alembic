// Recurrence expansion — FR-12 (daily routines), FR-14c/d (weekly and
// monthly known-date tasks), FR-17/FR-21 (repeat intervals in Phases C/D).

import type { ISODate, RepeatInterval } from '../domain/types';
import { addDays, compareDates, dayOfMonth, dayOfWeek, eachDay } from './dates';

/** FR-12: one instance for every date in the window, inclusive. */
export function expandDailyRoutine(windowStart: ISODate, windowEnd: ISODate): ISODate[] {
  return eachDay(windowStart, windowEnd);
}

/** FR-14c: every date in the window falling on the given weekday (0=Sun). */
export function expandWeeklyByWeekday(
  windowStart: ISODate,
  windowEnd: ISODate,
  weekday: number
): ISODate[] {
  return eachDay(windowStart, windowEnd).filter((d) => dayOfWeek(d) === weekday);
}

/**
 * FR-14d: every date in the window falling on the given day of month.
 * Months without that day (e.g. the 31st) contribute no instance.
 */
export function expandMonthlyByDay(
  windowStart: ISODate,
  windowEnd: ISODate,
  day: number
): ISODate[] {
  return eachDay(windowStart, windowEnd).filter((d) => dayOfMonth(d) === day);
}

/**
 * FR-17: occurrences of a repeating task between earliest and latest.
 * Weekly/Biweekly recur on the same weekday as the start (earliest) date;
 * Monthly recurs on the same day of month as the start date.
 * "No repeat" yields no fixed occurrences — the scheduler assigns the date.
 */
export function expandRepeat(
  earliest: ISODate,
  latest: ISODate,
  interval: RepeatInterval
): ISODate[] {
  if (compareDates(earliest, latest) > 0) return [];
  switch (interval) {
    case 'No repeat':
      return [];
    case 'Daily':
      return eachDay(earliest, latest);
    case 'Weekly': {
      const out: ISODate[] = [];
      for (let d = earliest; compareDates(d, latest) <= 0; d = addDays(d, 7)) out.push(d);
      return out;
    }
    case 'Biweekly': {
      const out: ISODate[] = [];
      for (let d = earliest; compareDates(d, latest) <= 0; d = addDays(d, 14)) out.push(d);
      return out;
    }
    case 'Monthly':
      return expandMonthlyByDay(earliest, latest, dayOfMonth(earliest));
  }
}
