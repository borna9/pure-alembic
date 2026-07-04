// Connection state for external services (IF-3..IF-5). OAuth tokens and
// app-specific passwords are stored per NFR-5 (see secureStore.ts).

import { secureDelete, secureGet, secureSet } from './secureStore';

export type ConnectionKey =
  | 'google' // OAuth tokens for Google Calendar
  | 'microsoft' // OAuth tokens for Microsoft Graph (Calendar + To Do)
  | 'icloud-caldav'; // Apple ID + app-specific password for iCloud CalDAV

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

export interface CaldavCredentials {
  appleId: string;
  appSpecificPassword: string;
}

const key = (k: ConnectionKey) => `pure-alembic.connection.${k}`;

export async function saveConnection(
  k: ConnectionKey,
  value: OAuthTokens | CaldavCredentials
): Promise<void> {
  await secureSet(key(k), JSON.stringify(value));
}

export async function loadConnection<T = OAuthTokens | CaldavCredentials>(
  k: ConnectionKey
): Promise<T | null> {
  const raw = await secureGet(key(k));
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function clearConnection(k: ConnectionKey): Promise<void> {
  await secureDelete(key(k));
}

export async function isConnected(k: ConnectionKey): Promise<boolean> {
  return (await secureGet(key(k))) != null;
}
