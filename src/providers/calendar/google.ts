// Google Calendar (IF-1/IF-2): events created via the REST API; the
// returned htmlLink is stored on the task (FR-28).

import type { CalendarProvider } from '../types';
import { getAccessToken, GOOGLE_OAUTH } from '../oauth';
import { endTimeFrom, localTimeZone } from '../datetime';
import { fetchWithTimeout } from '../http';

export const googleCalendarProvider: CalendarProvider = {
  async createEvent(spec) {
    const token = await getAccessToken(GOOGLE_OAUTH);
    const timeZone = localTimeZone();
    const res = await fetchWithTimeout(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: spec.title,
          description: spec.notes,
          start: { dateTime: `${spec.date}T${spec.startTime}:00`, timeZone },
          end: { dateTime: `${spec.date}T${endTimeFrom(spec.startTime, spec.hours)}:00`, timeZone },
        }),
      }
    );
    if (!res.ok) throw new Error(`Google Calendar: ${res.status} ${await res.text()}`);
    const event = (await res.json()) as { htmlLink?: string; id: string };
    return event.htmlLink ?? event.id;
  },
};
