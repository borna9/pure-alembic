// First-available-time rule — FR-26.
//
// Computed solely from the tasks/events already recorded for that day in
// the application's own database; the user's external calendar is
// ignored. The search runs from DAY_START to DAY_END; if no gap fits,
// the event starts at 09:00 (FR-26 fallback).

import type { TimeOfDay } from '../domain/types';

export const DAY_START_MINUTES = 9 * 60; // 09:00
export const DAY_END_MINUTES = 24 * 60; // midnight
export const FALLBACK_START: TimeOfDay = '09:00';

export interface BusyItem {
  startTime: TimeOfDay;
  hours: number;
}

export function timeToMinutes(t: TimeOfDay): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): TimeOfDay {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
}

/**
 * Earliest start time on the day at which `hours` fit before DAY_END
 * without overlapping any busy item. Items without a start time do not
 * block time. Falls back to 09:00 when nothing fits.
 */
export function firstAvailableTime(busy: BusyItem[], hours: number): TimeOfDay {
  const needed = Math.round(hours * 60);
  const intervals = busy
    .map((b) => {
      const start = timeToMinutes(b.startTime);
      return [start, start + Math.round(b.hours * 60)] as const;
    })
    .sort((a, b) => a[0] - b[0]);

  let cursor = DAY_START_MINUTES;
  for (const [start, end] of intervals) {
    if (start - cursor >= needed) break; // gap before this busy block fits
    cursor = Math.max(cursor, end);
  }
  if (cursor + needed <= DAY_END_MINUTES) return minutesToTime(cursor);
  return FALLBACK_START;
}
