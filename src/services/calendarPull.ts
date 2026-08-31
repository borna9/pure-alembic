// Bidirectional calendar sync (Google Calendar):
//  • calendar edits update the app task (and flow on to Supabase);
//  • app edits update the calendar event;
//  • deletions propagate both ways;
//  • both-sides-changed conflicts resolve calendar-wins (documented).
// Which side changed is decided against the task's externalSnapshot
// baseline (src/logic/calendarReconcile.ts).

import type { ExternalSnapshot } from '../domain/types';
import { reconcile } from '../logic/calendarReconcile';
import { deliveryTarget } from '../logic/delivery';
import { parseGoogleEventLink } from '../logic/googleEventLink';
import {
  deleteGoogleEvent,
  getGoogleEvent,
  GoogleEvent,
  updateGoogleEvent,
} from '../providers/calendar/google';
import { taskNotes } from '../providers/push';
import { useDataStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export interface PullSummary {
  updated: number;
  pushedToCalendar: number;
  deletedInApp: number;
  deletedInCalendar: number;
  errors: string[];
}

function eventFields(event: GoogleEvent): ExternalSnapshot | null {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dueDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: event.start?.dateTime ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : null,
    hours: Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100,
    description: event.summary ?? '',
  };
}

export async function pullCalendarChanges(
  onProgress?: (done: number, total: number) => void
): Promise<PullSummary> {
  const settings = useSettingsStore.getState();
  const summary: PullSummary = {
    updated: 0,
    pushedToCalendar: 0,
    deletedInApp: 0,
    deletedInCalendar: 0,
    errors: [],
  };

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
        // Deleted in the app → remove the calendar event, then unlink.
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
          const ev = eventFields(event);
          if (!ev) continue;
          const taskF: ExternalSnapshot = {
            dueDate: task.dueDate,
            startTime: task.startTime ?? null,
            hours: task.hours,
            description: task.description,
          };
          const action = reconcile(taskF, ev, task.externalSnapshot ?? null);

          if (action.kind === 'pull' || action.kind === 'conflict-pull') {
            useDataStore.getState().updateTask(task.id, {
              dueDate: action.fields.dueDate,
              startTime: action.fields.startTime,
              hours: action.fields.hours,
              description: action.fields.description || task.description,
              externalSnapshot: action.fields,
            });
            summary.updated++;
          } else if (action.kind === 'push') {
            // Keep the event's time when the app task has none.
            const startTime = action.fields.startTime ?? ev.startTime ?? '09:00';
            await updateGoogleEvent(eventId, {
              title: action.fields.description,
              date: action.fields.dueDate,
              startTime,
              hours: action.fields.hours,
              notes: taskNotes(task),
            });
            const snapshot = { ...action.fields, startTime };
            useDataStore.getState().updateTask(task.id, {
              startTime,
              externalSnapshot: snapshot,
            });
            summary.pushedToCalendar++;
          } else if (!task.externalSnapshot) {
            // In agreement but no baseline yet — record one.
            useDataStore.getState().updateTask(task.id, { externalSnapshot: ev });
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
