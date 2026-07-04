// iCloud Calendar via CalDAV with an app-specific password — IF-4 on
// non-Apple platforms.

import type { CalendarProvider } from '../types';
import { createCaldavEvent } from '../caldav';

export const icloudCaldavCalendarProvider: CalendarProvider = {
  createEvent: (spec) => createCaldavEvent(spec),
};
