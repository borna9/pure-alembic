// Even-spread scheduling — FR-19, FR-19a, FR-23.
//
// Tasks with a repeat interval already have fixed dates (expandRepeat);
// they count toward day loads but do not move. Non-repeating tasks are
// assigned dates here: processed Urgent → High → Medium → Low (FR-19),
// each placed on the least-loaded feasible day so the batch spreads
// evenly across the window, without exceeding any day's remaining
// capacity (FR-19a): availableHoursPerDay − daily-routine hours − hours
// already scheduled.

import type { ISODate, Priority } from '../domain/types';
import { PRIORITIES } from '../domain/types';
import { compareDates, eachDay } from './dates';

export interface SchedulableItem {
  id: string;
  priority: Priority;
  hours: number;
  earliest: ISODate;
  latest: ISODate;
}

export interface ScheduleInput {
  items: SchedulableItem[];
  availableHoursPerDay: number; // FR-32
  /** Hours of Daily-routine tasks per day (Section 1.3 "daily-routine hours"). */
  dailyRoutineHours: Record<ISODate, number>;
  /** Hours already occupied by fixed-date items (recurring instances, Phase B tasks…). */
  fixedHours: Record<ISODate, number>;
}

export interface ScheduleResult {
  /** Assigned date per item id. */
  assignments: Record<string, ISODate>;
  /** Total scheduled hours per day after assignment (routine + fixed + assigned). */
  dayLoads: Record<ISODate, number>;
  /** Ids of items that could not fit under the day-load cap and overflowed. */
  overCapacity: string[];
}

const priorityRank: Record<Priority, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p, i])
) as Record<Priority, number>;

export function scheduleEvenSpread(input: ScheduleInput): ScheduleResult {
  const { items, availableHoursPerDay, dailyRoutineHours, fixedHours } = input;

  const loads: Record<ISODate, number> = {};
  const load = (d: ISODate) => loads[d] ?? (dailyRoutineHours[d] ?? 0) + (fixedHours[d] ?? 0);

  // Stable sort by priority; equal priorities keep entry order.
  const ordered = [...items].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  const assignments: Record<string, ISODate> = {};
  const overCapacity: string[] = [];

  for (const item of ordered) {
    const days = eachDay(item.earliest, item.latest);
    if (days.length === 0) continue;

    // FR-19a: non-routine hours on a day must stay within
    // (availableHoursPerDay − routine hours). Since load() already
    // includes routine hours, that reduces to load + hours ≤ available.
    const feasible = days.filter((d) => load(d) + item.hours <= availableHoursPerDay);

    let chosen: ISODate;
    if (feasible.length > 0) {
      chosen = pickLeastLoadedEarliest(feasible, load);
    } else {
      // The task cannot fit anywhere without breaching FR-19a. It must
      // still get a date, so place it on the least-loaded day and report it.
      chosen = pickLeastLoadedEarliest(days, load);
      overCapacity.push(item.id);
    }

    loads[chosen] = load(chosen) + item.hours;
    assignments[item.id] = chosen;
  }

  // Report final loads for every day touched by routine, fixed, or assigned hours.
  const dayLoads: Record<ISODate, number> = {};
  for (const d of new Set([
    ...Object.keys(dailyRoutineHours),
    ...Object.keys(fixedHours),
    ...Object.keys(loads),
  ])) {
    dayLoads[d] = load(d);
  }

  return { assignments, dayLoads, overCapacity };
}

function pickLeastLoadedEarliest(days: ISODate[], load: (d: ISODate) => number): ISODate {
  let best = days[0];
  for (const d of days) {
    const diff = load(d) - load(best);
    if (diff < 0 || (diff === 0 && compareDates(d, best) < 0)) best = d;
  }
  return best;
}
