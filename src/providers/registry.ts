// Provider registry (IF-1). Providers are loaded lazily so platforms
// without a given integration (e.g. EventKit on the web) never import it.

import type { CalendarServiceKind, ReminderServiceKind } from '../store/settingsStore';
import type { CalendarProvider, ReminderProvider } from './types';

export async function getCalendarProvider(kind: CalendarServiceKind): Promise<CalendarProvider | null> {
  switch (kind) {
    case 'google':
      return (await import('./calendar/google')).googleCalendarProvider;
    case 'microsoft':
      return (await import('./calendar/microsoft')).microsoftCalendarProvider;
    case 'apple-eventkit':
      return (await import('./calendar/appleEventKit')).appleEventKitCalendarProvider;
    case 'icloud-caldav':
      return (await import('./calendar/icloudCaldav')).icloudCaldavCalendarProvider;
    default:
      return null;
  }
}

export async function getReminderProvider(kind: ReminderServiceKind): Promise<ReminderProvider | null> {
  switch (kind) {
    case 'apple-eventkit':
      return (await import('./reminders/appleEventKit')).appleEventKitReminderProvider;
    case 'microsoft-todo':
      return (await import('./reminders/microsoftTodo')).microsoftTodoReminderProvider;
    case 'apple-caldav':
      return (await import('./reminders/appleCaldav')).appleCaldavReminderProvider;
    default:
      return null;
  }
}
