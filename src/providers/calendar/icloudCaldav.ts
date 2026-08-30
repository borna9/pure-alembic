// iCloud Calendar via CalDAV with an app-specific password — IF-4 on
// non-Apple platforms.

import type { CalendarProvider } from '../types';
import { createCaldavEvent } from '../caldav';

export const icloudCaldavCalendarProvider: CalendarProvider = {
  async createEvent(spec) {
    const url = await createCaldavEvent(spec);
    return { url, id: url };
  },
};
