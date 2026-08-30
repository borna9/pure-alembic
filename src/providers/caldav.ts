// Minimal iCloud CalDAV client (IF-4, non-Apple platforms): app-specific
// password auth, principal/collection discovery, and VEVENT/VTODO
// creation. Android talks to caldav.icloud.com directly (no CORS in
// native fetch); the web routes through the caldav-proxy edge function.

import { Platform } from 'react-native';
import { newId } from '../lib/id';
import { getSupabase, isBackendConfigured } from '../supabase/client';
import { CaldavCredentials, loadConnection } from './connections';
import { fetchWithTimeout } from './http';
import { toIcsUtc, toLocalDate, endTimeFrom } from './datetime';

const CALDAV_BASE = 'https://caldav.icloud.com';

async function caldavFetch(
  creds: CaldavCredentials,
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<{ status: number; text: string; headers: Record<string, string> }> {
  const auth = 'Basic ' + btoa(`${creds.appleId}:${creds.appSpecificPassword}`);
  const headers = { ...init.headers, Authorization: auth };

  if (Platform.OS === 'web') {
    // Browsers block cross-origin CalDAV; a stateless proxy forwards the
    // request. Credentials transit TLS only and are never stored server-side.
    if (!isBackendConfigured()) {
      throw new Error('iCloud CalDAV on the web needs the Supabase backend (caldav-proxy).');
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('caldav-proxy', {
      body: { url, method: init.method, headers, body: init.body ?? null },
    });
    if (error) throw new Error(`CalDAV proxy: ${error.message}`);
    return data as { status: number; text: string; headers: Record<string, string> };
  }

  const res = await fetchWithTimeout(url, { method: init.method, headers, body: init.body });
  const text = await res.text();
  const outHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => (outHeaders[k] = v));
  return { status: res.status, text, headers: outHeaders };
}

function extractHref(xml: string, tag: string): string | null {
  // Tolerant of namespace prefixes: <d:current-user-principal><d:href>…
  const re = new RegExp(`<[^>]*${tag}[^>]*>\\s*<[^>]*href[^>]*>([^<]+)<`, 'i');
  return re.exec(xml)?.[1]?.trim() ?? null;
}

const abs = (path: string) => (path.startsWith('http') ? path : `${CALDAV_BASE}${path}`);

interface CaldavHome {
  creds: CaldavCredentials;
  homeUrl: string;
}

async function discoverHome(): Promise<CaldavHome> {
  const creds = await loadConnection<CaldavCredentials>('icloud-caldav');
  if (!creds) throw new Error('iCloud is not connected. Open Settings → Calendar & Reminders.');

  const propfind = (url: string, body: string, depth = '0') =>
    caldavFetch(creds, url, {
      method: 'PROPFIND',
      headers: { 'Content-Type': 'application/xml', Depth: depth },
      body,
    });

  const principalRes = await propfind(
    `${CALDAV_BASE}/`,
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
  );
  if (principalRes.status === 401) throw new Error('iCloud rejected the Apple ID or app-specific password.');
  const principal = extractHref(principalRes.text, 'current-user-principal');
  if (!principal) throw new Error('iCloud CalDAV: could not discover the account principal.');

  const homeRes = await propfind(
    abs(principal),
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>'
  );
  const home = extractHref(homeRes.text, 'calendar-home-set');
  if (!home) throw new Error('iCloud CalDAV: could not discover the calendar home.');

  return { creds, homeUrl: abs(home) };
}

/** First collection in the home supporting the given component (VEVENT/VTODO). */
async function findCollection(home: CaldavHome, component: 'VEVENT' | 'VTODO'): Promise<string> {
  const res = await caldavFetch(home.creds, home.homeUrl, {
    method: 'PROPFIND',
    headers: { 'Content-Type': 'application/xml', Depth: '1' },
    body:
      '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>',
  });
  // Split into <response> blocks and pick the first calendar collection
  // whose supported set includes the wanted component.
  const blocks = res.text.split(/<\/[a-zA-Z]*:?response>/i);
  for (const block of blocks) {
    if (!/calendar(?![-a-z])/i.test(block)) continue;
    const compRe = new RegExp(`comp[^>]*name="${component}"`, 'i');
    if (!compRe.test(block)) continue;
    const href = /<[^>]*href[^>]*>([^<]+)</i.exec(block)?.[1];
    if (href) return abs(href.trim());
  }
  throw new Error(`iCloud CalDAV: no collection supporting ${component} found.`);
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsWrap(lines: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pure Alembic//EN', ...lines, 'END:VCALENDAR'].join('\r\n');
}

async function putIcs(home: CaldavHome, collectionUrl: string, uid: string, ics: string): Promise<string> {
  const url = `${collectionUrl.replace(/\/$/, '')}/${uid}.ics`;
  const res = await caldavFetch(home.creds, url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    body: ics,
  });
  if (res.status >= 300) throw new Error(`iCloud CalDAV PUT failed (${res.status}).`);
  return url;
}

/** Used by Settings after credential entry to confirm iCloud accepts them. */
export async function verifyCaldavConnection(): Promise<void> {
  await discoverHome();
}

export async function createCaldavEvent(spec: {
  title: string;
  date: string;
  startTime: string;
  hours: number;
  notes: string;
}): Promise<string> {
  const home = await discoverHome();
  const collection = await findCollection(home, 'VEVENT');
  const uid = newId();
  const start = toLocalDate(spec.date, spec.startTime);
  const end = toLocalDate(spec.date, endTimeFrom(spec.startTime, spec.hours));
  const ics = icsWrap([
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${icsEscape(spec.title)}`,
    `DESCRIPTION:${icsEscape(spec.notes)}`,
    'END:VEVENT',
  ]);
  return putIcs(home, collection, uid, ics);
}

export async function createCaldavTodo(spec: { title: string; notes: string }): Promise<string> {
  const home = await discoverHome();
  const collection = await findCollection(home, 'VTODO');
  const uid = newId();
  const ics = icsWrap([
    'BEGIN:VTODO',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `SUMMARY:${icsEscape(spec.title)}`,
    `DESCRIPTION:${icsEscape(spec.notes)}`,
    'END:VTODO',
  ]);
  return putIcs(home, collection, uid, ics);
}
