// Google Calendar (IF-1/IF-2): create for delivery, plus read/delete
// used by the two-way sync pull (src/services/calendarPull.ts).

import type { CalendarProvider } from '../types';
import { getAccessToken, GOOGLE_OAUTH } from '../oauth';
import { endTimeFrom, localTimeZone } from '../datetime';
import { fetchWithTimeout } from '../http';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken(GOOGLE_OAUTH);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const googleCalendarProvider: CalendarProvider = {
  async createEvent(spec) {
    const timeZone = localTimeZone();
    const res = await fetchWithTimeout(BASE, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        summary: spec.title,
        description: spec.notes,
        start: { dateTime: `${spec.date}T${spec.startTime}:00`, timeZone },
        end: { dateTime: `${spec.date}T${endTimeFrom(spec.startTime, spec.hours)}:00`, timeZone },
      }),
    });
    if (!res.ok) throw new Error(`Google Calendar: ${res.status} ${await res.text()}`);
    const event = (await res.json()) as { htmlLink?: string; id: string };
    return { url: event.htmlLink ?? null, id: event.id };
  },
};

export interface GoogleEvent {
  id: string;
  status: string; // 'confirmed' | 'cancelled' | …
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Current state of an event; null when it no longer exists (404/410). */
export async function getGoogleEvent(eventId: string): Promise<GoogleEvent | null> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(eventId)}`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google Calendar: ${res.status} ${await res.text()}`);
  return (await res.json()) as GoogleEvent;
}

/** Update an event's title, notes, and times (bidirectional sync push). */
export async function updateGoogleEvent(
  eventId: string,
  spec: { title: string; date: string; startTime: string; hours: number; notes: string }
): Promise<void> {
  const timeZone = localTimeZone();
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({
      summary: spec.title,
      description: spec.notes,
      start: { dateTime: `${spec.date}T${spec.startTime}:00`, timeZone },
      end: { dateTime: `${spec.date}T${endTimeFrom(spec.startTime, spec.hours)}:00`, timeZone },
    }),
  });
  if (!res.ok) throw new Error(`Google Calendar update: ${res.status} ${await res.text()}`);
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  // Already gone counts as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete: ${res.status} ${await res.text()}`);
  }
}
