// Outlook / Office 365 Calendar via Microsoft Graph (IF-1/IF-2).

import type { CalendarProvider } from '../types';
import { getAccessToken, MICROSOFT_OAUTH } from '../oauth';
import { endTimeFrom, localTimeZone } from '../datetime';

export const microsoftCalendarProvider: CalendarProvider = {
  async createEvent(spec) {
    const token = await getAccessToken(MICROSOFT_OAUTH);
    const timeZone = localTimeZone();
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: spec.title,
        body: { contentType: 'text', content: spec.notes },
        start: { dateTime: `${spec.date}T${spec.startTime}:00`, timeZone },
        end: { dateTime: `${spec.date}T${endTimeFrom(spec.startTime, spec.hours)}:00`, timeZone },
      }),
    });
    if (!res.ok) throw new Error(`Outlook Calendar: ${res.status} ${await res.text()}`);
    const event = (await res.json()) as { webLink?: string; id: string };
    return event.webLink ?? event.id;
  },
};
