// Delivery of committed tasks to the configured calendar and reminder
// services (FR-25..FR-28). Providers are registered per IF-1; until the
// user connects a service in Settings this is a no-op and tasks simply
// live in the app.

import type { StoredTask } from '../store/dataStore';
import { useDataStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { deliveryTarget } from '../logic/delivery';
import { firstAvailableTime } from '../logic/firstAvailable';
import { getCalendarProvider, getReminderProvider } from './registry';

export interface PushSummary {
  calendarEvents: number;
  reminders: number;
  errors: string[];
}

/** All task information, embedded in event/reminder notes per FR-25/FR-27. */
export function taskNotes(task: StoredTask): string {
  const lines = [
    `Pure Alembic task`,
    `Type: ${task.taskType}`,
    `Priority: ${task.priority}`,
    `Hours: ${task.hours}`,
    `Due date: ${task.dueDate}`,
  ];
  if (task.startDate) lines.push(`Start date: ${task.startDate}`);
  if (task.startTime) lines.push(`Start time: ${task.startTime}`);
  if (task.notes) lines.push('', task.notes);
  return lines.join('\n');
}

/**
 * Push every committed task that has no external link yet (FR-28) to the
 * configured services — the recovery path for tasks committed before a
 * service was connected/active.
 */
export async function pushUnlinkedTasks(
  onProgress?: (done: number, total: number) => void
): Promise<PushSummary> {
  const tasks = Object.values(useDataStore.getState().tasks).filter(
    (t) => !t._deleted && !t.externalLink
  );
  return pushTasksToServices(tasks, onProgress);
}

export async function pushTasksToServices(
  tasks: StoredTask[],
  onProgress?: (done: number, total: number) => void
): Promise<PushSummary> {
  const settings = useSettingsStore.getState();
  const data = useDataStore.getState();
  const summary: PushSummary = { calendarEvents: 0, reminders: 0, errors: [] };

  const calendar = settings.calendarService ? await getCalendarProvider(settings.calendarService) : null;
  const reminder = settings.reminderService ? await getReminderProvider(settings.reminderService) : null;

  let processed = 0;
  for (const task of tasks) {
    try {
      // Routing per src/logic/delivery.ts: daily routines and
      // undated/zero-hour tasks → reminders; the rest → calendar.
      if (deliveryTarget(task) === 'calendar' && calendar) {
        // FR-26: no start time → first available time from the app's own
        // records for that day (external calendars ignored); 09:00 fallback.
        const start = task.startTime ?? firstAvailableTime(data.busyItemsOn(task.dueDate), task.hours);
        const created = await calendar.createEvent({
          title: task.description,
          date: task.dueDate,
          startTime: start,
          hours: task.hours,
          notes: taskNotes(task),
        });
        if (created.url || created.id) {
          data.updateTask(task.id, {
            externalLink: created.url ?? created.id, // FR-28
            externalId: created.id,
          });
          if (!task.startTime) data.updateTask(task.id, { startTime: start });
          summary.calendarEvents++;
        }
      } else if (deliveryTarget(task) === 'reminder' && reminder) {
        const created = await reminder.createReminder({ title: task.description, notes: taskNotes(task) });
        if (created.url || created.id) {
          data.updateTask(task.id, {
            externalLink: created.url ?? created.id, // FR-28
            externalId: created.id,
          });
          summary.reminders++;
        }
      }
    } catch (e) {
      summary.errors.push(`${task.description}: ${e instanceof Error ? e.message : String(e)}`);
    }
    onProgress?.(++processed, tasks.length);
  }
  return summary;
}
