// Two-way calendar sync, v1 (Google Calendar):
//  • events edited in the calendar update the app task (date, start
//    time, hours, description) through the normal field-clock path, so
//    the change also reaches Supabase and other devices;
//  • events deleted in the calendar delete the app task;
//  • tasks deleted in the app delete their calendar event.
// Conflicting same-field edits follow calendar-wins here — the calendar
// is treated as the latest editor at pull time.

import { deliveryTarget } from '../logic/delivery';
import { parseGoogleEventLink } from '../logic/googleEventLink';
import { deleteGoogleEvent, getGoogleEvent, GoogleEvent } from '../providers/calendar/google';
import { useDataStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export interface PullSummary {
  updated: number;
  deletedInApp: number;
  deletedInCalendar: number;
  errors: string[];
}

function eventFields(event: GoogleEvent): {
  dueDate?: string;
  startTime?: string;
  hours?: number;
  description?: string;
} | null {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dueDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: event.start?.dateTime ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : undefined,
    hours: Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100,
    description: event.summary,
  };
}

export async function pullCalendarChanges(
  onProgress?: (done: number, total: number) => void
): Promise<PullSummary> {
  const settings = useSettingsStore.getState();
  const summary: PullSummary = { updated: 0, deletedInApp: 0, deletedInCalendar: 0, errors: [] };

  if (settings.calendarService !== 'google') {
    throw new Error('Two-way calendar sync currently supports Google Calendar only.');
  }

  const data = useDataStore.getState();
  const linked = Object.values(data.tasks).filter(
    (t) =>
      (t.externalId || (t.externalLink && parseGoogleEventLink(t.externalLink))) &&
      deliveryTarget(t) === 'calendar'
  );

  let processed = 0;
  for (const task of linked) {
    try {
      const eventId = task.externalId ?? parseGoogleEventLink(task.externalLink!)!;
      if (!task.externalId) {
        // Backfill ids for tasks delivered before ids were stored.
        useDataStore.getState().updateTask(task.id, { externalId: eventId });
      }

      if (task._deleted) {
        // Deleted in the app → remove the calendar event, then unlink so
        // later pulls skip it.
        await deleteGoogleEvent(eventId);
        useDataStore.getState().updateTask(task.id, { externalId: null, externalLink: null });
        summary.deletedInCalendar++;
      } else {
        const event = await getGoogleEvent(eventId);
        if (!event || event.status === 'cancelled') {
          // Deleted in the calendar → delete the task (tombstone syncs on).
          useDataStore.getState().deleteTask(task.id);
          summary.deletedInApp++;
        } else {
          const fields = eventFields(event);
          if (fields) {
            const patch: Record<string, unknown> = {};
            if (fields.dueDate && fields.dueDate !== task.dueDate) patch.dueDate = fields.dueDate;
            if (fields.startTime && fields.startTime !== task.startTime) patch.startTime = fields.startTime;
            if (fields.hours != null && Math.abs(fields.hours - task.hours) > 0.01) patch.hours = fields.hours;
            if (fields.description && fields.description !== task.description) patch.description = fields.description;
            if (Object.keys(patch).length > 0) {
              useDataStore.getState().updateTask(task.id, patch);
              summary.updated++;
            }
          }
        }
      }
    } catch (e) {
      summary.errors.push(`${task.description}: ${e instanceof Error ? e.message : String(e)}`);
    }
    onProgress?.(++processed, linked.length);
  }
  return summary;
}
