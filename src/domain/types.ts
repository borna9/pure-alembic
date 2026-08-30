// Pure Alembic domain model — SRS §3 (Data Requirements).

// DR-1: task types; default for a new task is "Blocked time".
export const TASK_TYPES = [
  'Daily routine',
  'Scheduled',
  'Blocked time',
  'Need to schedule',
  'Wasted time',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const DEFAULT_TASK_TYPE: TaskType = 'Blocked time';

// DR-2: priorities; default is "Medium".
export const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: Priority = 'Medium';

/** Calendar date with no time component, formatted YYYY-MM-DD. */
export type ISODate = string;
/** Time of day, formatted HH:MM (24h). */
export type TimeOfDay = string;

// DR-4: each tag belongs to exactly one category.
export interface Category {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
  categoryId: string;
}

// §3.1 Task entity.
export interface Task {
  id: string;
  description: string;
  completed: boolean; // starts false (FR-8)
  taskType: TaskType;
  priority: Priority;
  tagIds: string[];
  notes: string;
  hours: number;
  dueDate: ISODate;
  /** Start of a date range (FR-14a); empty for due-date-only tasks (FR-14b). */
  startDate?: ISODate | null;
  startTime?: TimeOfDay | null;
  /** URL of the linked calendar event or reminder (FR-28). */
  externalLink?: string | null;
  /** Provider-side id of the linked item, for two-way sync. */
  externalId?: string | null;
  /** Links preparation/follow-up tasks (FR-9/FR-10) to their originating task. */
  parentTaskId?: string | null;
}

// Repeat intervals for Phases C and D (FR-17/FR-21).
export const REPEAT_INTERVALS = ['No repeat', 'Daily', 'Weekly', 'Biweekly', 'Monthly'] as const;
export type RepeatInterval = (typeof REPEAT_INTERVALS)[number];

// FR-33: four planning cycles per year, defined by start day/month.
export interface CycleStart {
  day: number; // 1-31
  month: number; // 1-12
}
export const DEFAULT_CYCLE_STARTS: CycleStart[] = [
  { day: 1, month: 9 },
  { day: 1, month: 1 },
  { day: 1, month: 4 },
  { day: 1, month: 7 },
];

// FR-32: plannable hours per day, default 24.
export const DEFAULT_AVAILABLE_HOURS_PER_DAY = 24;
