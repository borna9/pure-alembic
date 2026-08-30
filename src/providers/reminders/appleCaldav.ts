// Apple Reminders via CalDAV (VTODO) with an app-specific password —
// IF-4 on non-Apple platforms.

import type { ReminderProvider } from '../types';
import { createCaldavTodo } from '../caldav';

export const appleCaldavReminderProvider: ReminderProvider = {
  async createReminder(spec) {
    const url = await createCaldavTodo(spec);
    return { url, id: url };
  },
};
