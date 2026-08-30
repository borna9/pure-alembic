// Expands a Screen 1 planning session into concrete task instances
// (SRS §4.2). Pure: no store or React imports, unit-tested.

import type {
  FlexibleDraft,
  GeneratedTask,
  KnownDateDraft,
  PlanningSession,
  RoutineDraft,
} from '../domain/planning';
import type { ISODate } from '../domain/types';
import { compareDates, eachDay } from './dates';
import { inferHours } from './hours';
import { makeFollowUpTask, makePreparationTask } from './prepFollowUp';
import { scheduleEvenSpread, SchedulableItem } from './scheduling';
import {
  expandDailyRoutine,
  expandMonthlyByDay,
  expandRepeat,
  expandWeeklyByWeekday,
} from './recurrence';

export interface GeneratePlanResult {
  tasks: GeneratedTask[];
  /** localIds of tasks that breached the FR-19a day-load cap. */
  overCapacityIds: string[];
}

export function generatePlan(
  session: PlanningSession,
  availableHoursPerDay: number
): GeneratePlanResult {
  let seq = 0;
  const nextId = () => `gen-${++seq}`;
  const tasks: GeneratedTask[] = [];
  const overCapacityIds: string[] = [];

  // Hours of daily-routine tasks per day — baseline for FR-5 and FR-19a.
  const routineHours: Record<ISODate, number> = {};
  // Hours of fixed-date, non-routine tasks per day (Phase B + recurring C/D).
  const fixedHours: Record<ISODate, number> = {};

  const routineFor = (d: ISODate) => routineHours[d] ?? 0;
  const draftHours = (draft: { hours: number; dayFraction: RoutineDraft['dayFraction'] }, day: ISODate) =>
    draft.dayFraction
      ? inferHours(draft.dayFraction, availableHoursPerDay, routineFor(day))
      : draft.hours;

  const addDerived = (
    draft: RoutineDraft,
    parent: GeneratedTask,
    categoryId: string | null,
    firstDate: ISODate,
    lastDate: ISODate
  ) => {
    // FR-9 / FR-10: optional preparation and follow-up tasks at ±1 week.
    if (draft.prepHours > 0) {
      const spec = makePreparationTask(
        { id: parent.localId, description: draft.description, tagIds: [] },
        draft.prepHours,
        firstDate
      );
      tasks.push({
        localId: nextId(),
        sourceDraftId: draft.localId,
        parentLocalId: parent.localId,
        description: spec.description,
        taskType: spec.taskType,
        priority: parent.priority,
        tagNames: [...draft.tagNames],
        categoryId,
        notes: '',
        hours: spec.hours,
        dueDate: spec.dueDate,
        startDate: null,
        startTime: null,
      });
    }
    if (draft.followUpHours > 0) {
      const spec = makeFollowUpTask(
        { id: parent.localId, description: draft.description, tagIds: [] },
        draft.followUpHours,
        lastDate
      );
      tasks.push({
        localId: nextId(),
        sourceDraftId: draft.localId,
        parentLocalId: parent.localId,
        description: spec.description,
        taskType: spec.taskType,
        priority: parent.priority,
        tagNames: [...draft.tagNames],
        categoryId,
        notes: '',
        hours: spec.hours,
        dueDate: spec.dueDate,
        startDate: null,
        startTime: null,
      });
    }
  };

  // ---- Phase A: daily routines (FR-11/FR-12) -------------------------------
  for (const draft of session.routineDrafts) {
    const days = expandDailyRoutine(session.windowStart, session.windowEnd);
    let first: GeneratedTask | null = null;
    for (const day of days) {
      const hours = draftHours(draft, day);
      const t: GeneratedTask = {
        localId: nextId(),
        sourceDraftId: draft.localId,
        description: draft.description,
        taskType: 'Daily routine',
        priority: draft.priority,
        tagNames: [...draft.tagNames],
        categoryId: session.routineCategoryId,
        notes: draft.notes,
        hours,
        dueDate: day,
        startDate: null,
        startTime: null,
      };
      tasks.push(t);
      routineHours[day] = routineFor(day) + hours;
      first ??= t;
    }
    if (first) addDerived(draft, first, session.routineCategoryId, session.windowStart, session.windowEnd);
  }

  // ---- Phase B: tasks with known dates (FR-13..FR-15) ----------------------
  for (const draft of session.knownDrafts) {
    const instances = knownDateInstances(draft, session);
    let firstTask: GeneratedTask | null = null;
    let lastDate: ISODate | null = null;
    for (const inst of instances) {
      const hours = draftHours(draft, inst.dueDate);
      const t: GeneratedTask = {
        localId: nextId(),
        sourceDraftId: draft.localId,
        description: draft.description,
        taskType: draft.taskType,
        priority: draft.priority,
        tagNames: [...draft.tagNames],
        categoryId: session.knownCategoryId,
        notes: draft.notes,
        hours,
        dueDate: inst.dueDate,
        startDate: inst.startDate ?? null,
        startTime: draft.startTime ?? null,
      };
      tasks.push(t);
      fixedHours[inst.dueDate] = (fixedHours[inst.dueDate] ?? 0) + hours;
      firstTask ??= t;
      lastDate = inst.dueDate;
    }
    if (firstTask && lastDate) {
      addDerived(draft, firstTask, session.knownCategoryId, firstTask.dueDate, lastDate);
    }
  }

  // ---- Phases C and D: scheduled by the app (FR-16..FR-23) -----------------
  // FR-19 runs after Phase C entry, FR-23 after Phase D with the same rules;
  // Phase C assignments therefore count as fixed load when D is scheduled.
  schedulePhase(session.scheduleDrafts, 'Need to schedule', session.scheduleCategoryId);
  schedulePhase(session.blockDrafts, 'Blocked time', session.blockCategoryId);

  function schedulePhase(
    drafts: FlexibleDraft[],
    taskType: 'Need to schedule' | 'Blocked time',
    categoryId: string | null
  ) {
    const pending: { draft: FlexibleDraft; item: SchedulableItem }[] = [];

    for (const draft of drafts) {
      const expanded = expandRepeat(draft.earliest, draft.latest, draft.repeat);
      // Occurrence-count alternative to an end date: keep the first N.
      const occurrences =
        draft.occurrenceCount && draft.occurrenceCount > 0
          ? expanded.slice(0, draft.occurrenceCount)
          : expanded;
      if (occurrences.length > 0) {
        // Recurring: dates are fixed by the repeat pattern (FR-17/FR-21).
        let firstTask: GeneratedTask | null = null;
        for (const day of occurrences) {
          const hours = draftHours(draft, day);
          const t: GeneratedTask = {
            localId: nextId(),
            sourceDraftId: draft.localId,
            description: draft.description,
            taskType,
            priority: draft.priority,
            tagNames: [...draft.tagNames],
            categoryId,
            notes: draft.notes,
            hours,
            dueDate: day,
            startDate: null,
            startTime: draft.startTime ?? null,
          };
          tasks.push(t);
          fixedHours[day] = (fixedHours[day] ?? 0) + hours;
          firstTask ??= t;
        }
        if (firstTask) {
          addDerived(draft, firstTask, categoryId, occurrences[0], occurrences[occurrences.length - 1]);
        }
      } else {
        // No repeat: the even-spread scheduler assigns the date (FR-19).
        // Day-fraction hours are provisionally computed against the
        // earliest day's routine load, then recomputed for the assigned day.
        pending.push({
          draft,
          item: {
            id: draft.localId,
            priority: draft.priority,
            hours: draftHours(draft, draft.earliest),
            earliest: clampDate(draft.earliest, session),
            latest: clampDate(draft.latest, session),
          },
        });
      }
    }

    const result = scheduleEvenSpread({
      items: pending.map((p) => p.item),
      availableHoursPerDay,
      dailyRoutineHours: routineHours,
      fixedHours,
    });

    for (const { draft } of pending) {
      const day = result.assignments[draft.localId];
      if (!day) continue;
      const hours = draftHours(draft, day);
      const over = result.overCapacity.includes(draft.localId);
      const t: GeneratedTask = {
        localId: nextId(),
        sourceDraftId: draft.localId,
        description: draft.description,
        taskType,
        priority: draft.priority,
        tagNames: [...draft.tagNames],
        categoryId,
        notes: draft.notes,
        hours,
        dueDate: day,
        startDate: null,
        startTime: draft.startTime ?? null,
        overCapacity: over || undefined,
      };
      tasks.push(t);
      fixedHours[day] = (fixedHours[day] ?? 0) + hours;
      if (over) overCapacityIds.push(t.localId);
      // FR-19: prep/follow-up placed one week before/after the parent.
      addDerived(draft, t, categoryId, day, day);
    }
  }

  return { tasks, overCapacityIds };
}

function knownDateInstances(
  draft: KnownDateDraft,
  session: PlanningSession
): { dueDate: ISODate; startDate?: ISODate }[] {
  switch (draft.mode) {
    case 'range':
      // FR-14a: explicit start and end date; the task is due at the end.
      if (!draft.startDate || !draft.endDate) return [];
      return [{ dueDate: draft.endDate, startDate: draft.startDate }];
    case 'dueOnly':
      // FR-14b: start date left empty, end date equals the due date.
      if (!draft.dueDate) return [];
      return [{ dueDate: draft.dueDate }];
    case 'weekly': {
      // FR-14c: one instance per qualifying weekday in the window.
      if (draft.weekday == null) return [];
      const days = expandWeeklyByWeekday(session.windowStart, session.windowEnd, draft.weekday);
      return capOccurrences(days, draft.occurrenceCount).map((d) => ({ dueDate: d }));
    }
    case 'monthly': {
      // FR-14d: one instance per qualifying day of month in the window.
      if (draft.dayOfMonth == null) return [];
      const days = expandMonthlyByDay(session.windowStart, session.windowEnd, draft.dayOfMonth);
      return capOccurrences(days, draft.occurrenceCount).map((d) => ({ dueDate: d }));
    }
  }
}

function capOccurrences(days: ISODate[], count?: number): ISODate[] {
  return count && count > 0 ? days.slice(0, count) : days;
}

function clampDate(d: ISODate, session: PlanningSession): ISODate {
  // FR-4: all dates in the session fall within the planning window.
  if (compareDates(d, session.windowStart) < 0) return session.windowStart;
  if (compareDates(d, session.windowEnd) > 0) return session.windowEnd;
  return d;
}

/** Days in the window with their total planned load, for review display. */
export function summarizeLoads(
  tasks: GeneratedTask[],
  windowStart: ISODate,
  windowEnd: ISODate
): { day: ISODate; hours: number }[] {
  const byDay: Record<ISODate, number> = {};
  for (const t of tasks) byDay[t.dueDate] = (byDay[t.dueDate] ?? 0) + t.hours;
  return eachDay(windowStart, windowEnd).map((day) => ({ day, hours: byDay[day] ?? 0 }));
}
