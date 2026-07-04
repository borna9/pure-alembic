// Draft task entries collected during a Screen 1 planning session
// (SRS §4.2), before they are expanded into concrete Task records.

import type { DayFraction } from '../logic/hours';
import type { ISODate, Priority, RepeatInterval, TaskType, TimeOfDay } from './types';

// §4.2.2 common per-task behavior (FR-5..FR-10).
export interface DraftBase {
  localId: string;
  description: string;
  priority: Priority;
  /** Tag names; resolved to Tag records at commit (FR-6, DR-5/DR-6). */
  tagNames: string[];
  notes: string;
  /** Entered hours (FR-5) — ignored when dayFraction is set. */
  hours: number;
  /** Full/Half/Quarter day (FR-5) — hours computed per day when set. */
  dayFraction: DayFraction | null;
  prepHours: number; // FR-9: 0 = no preparation task
  followUpHours: number; // FR-10: 0 = no follow-up task
}

/** Phase A (FR-11): type fixed to "Daily routine", no due date / start time. */
export type RoutineDraft = DraftBase;

/** Phase B (FR-13..FR-15): tasks whose dates are already known. */
export type KnownDateMode = 'range' | 'dueOnly' | 'weekly' | 'monthly';
export interface KnownDateDraft extends DraftBase {
  taskType: TaskType;
  mode: KnownDateMode;
  startDate?: ISODate; // range (FR-14a)
  endDate?: ISODate; // range (FR-14a)
  dueDate?: ISODate; // dueOnly (FR-14b)
  weekday?: number; // weekly, 0=Sun (FR-14c)
  dayOfMonth?: number; // monthly (FR-14d)
  startTime?: TimeOfDay;
}

/** Phases C and D (FR-16..FR-23): earliest/latest window plus repeat. */
export interface FlexibleDraft extends DraftBase {
  earliest: ISODate;
  latest: ISODate;
  repeat: RepeatInterval;
  startTime?: TimeOfDay;
}

export interface PlanningSession {
  windowStart: ISODate; // FR-4
  windowEnd: ISODate;
  routineCategoryId: string | null;
  knownCategoryId: string | null; // FR-13: category chosen per batch
  scheduleCategoryId: string | null; // FR-16
  blockCategoryId: string | null; // FR-20
  routineDrafts: RoutineDraft[];
  knownDrafts: KnownDateDraft[];
  scheduleDrafts: FlexibleDraft[]; // task type "Need to schedule" (FR-18)
  blockDrafts: FlexibleDraft[]; // task type "Blocked time" (FR-22)
}

/** A concrete task produced from the session, pending review (FR-24). */
export interface GeneratedTask {
  localId: string;
  sourceDraftId: string;
  /** Set on preparation/follow-up tasks (FR-9/FR-10). */
  parentLocalId?: string;
  description: string;
  taskType: TaskType;
  priority: Priority;
  tagNames: string[];
  categoryId: string | null;
  notes: string;
  hours: number;
  dueDate: ISODate;
  startDate?: ISODate | null;
  startTime?: TimeOfDay | null;
  /** FR-19a: flagged when the day-load cap could not be satisfied. */
  overCapacity?: boolean;
}
