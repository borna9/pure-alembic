// Preparation and follow-up tasks — FR-9 / FR-10.

import type { ISODate, Task } from '../domain/types';
import { addDays } from './dates';

export interface DerivedTaskSpec {
  description: string;
  taskType: 'Blocked time';
  hours: number;
  dueDate: ISODate;
  tagIds: string[];
  parentTaskId: string;
}

/**
 * FR-9: same category/tags as the original, description prefixed with
 * "Preparation for ", type "Blocked time", due one week before the
 * originating task's due date (or first occurrence).
 */
export function makePreparationTask(
  parent: Pick<Task, 'id' | 'description' | 'tagIds'>,
  prepHours: number,
  parentFirstDate: ISODate
): DerivedTaskSpec {
  return {
    description: `Preparation for ${parent.description}`,
    taskType: 'Blocked time',
    hours: prepHours,
    dueDate: addDays(parentFirstDate, -7),
    tagIds: [...parent.tagIds],
    parentTaskId: parent.id,
  };
}

/**
 * FR-10: as FR-9, but prefixed "Follow up on " and due one week after
 * the originating task's due date (or last occurrence).
 */
export function makeFollowUpTask(
  parent: Pick<Task, 'id' | 'description' | 'tagIds'>,
  followUpHours: number,
  parentLastDate: ISODate
): DerivedTaskSpec {
  return {
    description: `Follow up on ${parent.description}`,
    taskType: 'Blocked time',
    hours: followUpHours,
    dueDate: addDays(parentLastDate, 7),
    tagIds: [...parent.tagIds],
    parentTaskId: parent.id,
  };
}
