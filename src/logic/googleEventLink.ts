// Recover a Google Calendar event id from a stored htmlLink (FR-28) for
// tasks delivered before the app started saving event ids. The link's
// `eid` parameter is base64url("<eventId> <calendarEmail>").

function base64Decode(b64: string): string {
  if (typeof atob === 'function') return atob(b64);
  const B = (globalThis as Record<string, unknown>).Buffer as
    | { from(input: string, encoding: string): { toString(encoding: string): string } }
    | undefined;
  if (B) return B.from(b64, 'base64').toString('utf8');
  throw new Error('No base64 decoder available');
}

export function parseGoogleEventLink(link: string): string | null {
  const m = /[?&]eid=([A-Za-z0-9_-]+)/.exec(link);
  if (!m) return null;
  try {
    const decoded = base64Decode(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const [eventId] = decoded.split(' ');
    return eventId || null;
  } catch {
    return null;
  }
}
