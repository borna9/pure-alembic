// Delivery policy: which committed tasks become calendar events vs
// reminder items.
//
// Product decision (owner, Aug 2026), deviating from FR-25: daily
// routines never become calendar events — a routine repeated across a
// long window floods the calendar. Routines, undated tasks, and
// zero-hour tasks all go to the reminder service (FR-27).

import type { Task } from '../domain/types';

export type DeliveryTarget = 'calendar' | 'reminder';

export function deliveryTarget(
  task: Pick<Task, 'dueDate' | 'hours' | 'taskType'>
): DeliveryTarget {
  if (task.taskType === 'Daily routine') return 'reminder';
  if (!task.dueDate || task.hours <= 0) return 'reminder';
  return 'calendar';
}
