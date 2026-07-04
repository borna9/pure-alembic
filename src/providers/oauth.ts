// OAuth 2.0 authorization-code flow with PKCE (IF-3) for Google and
// Microsoft. The user signs in on the provider's own page (passkeys
// welcome); the app receives only tokens, never a password. Tokens are
// refreshed automatically; an expired refresh chain surfaces an error
// prompting re-authentication (IF-5).

import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { loadConnection, OAuthTokens, saveConnection, type ConnectionKey } from './connections';

WebBrowser.maybeCompleteAuthSession();

export interface OAuthProviderConfig {
  connection: ConnectionKey;
  clientIdEnv: string;
  clientId: string | undefined;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  /** Extra params, e.g. Google's access_type=offline. */
  extraParams?: Record<string, string>;
}

export const GOOGLE_OAUTH: OAuthProviderConfig = {
  connection: 'google',
  clientIdEnv: 'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
  extraParams: { access_type: 'offline', prompt: 'consent' },
};

export const MICROSOFT_OAUTH: OAuthProviderConfig = {
  connection: 'microsoft',
  clientIdEnv: 'EXPO_PUBLIC_MICROSOFT_CLIENT_ID',
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['Calendars.ReadWrite', 'Tasks.ReadWrite', 'offline_access'],
};

const redirectUri = makeRedirectUri({ scheme: 'purealembic', path: 'oauth' });

/** Interactive connect: full PKCE round trip, tokens saved per NFR-5. */
export async function connectOAuth(config: OAuthProviderConfig): Promise<void> {
  if (!config.clientId) {
    throw new Error(
      `Missing ${config.clientIdEnv}. Register a (free) OAuth app and set it — see docs/SETUP.md.`
    );
  }

  const request = new AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri,
    usePKCE: true,
    extraParams: config.extraParams,
  });

  const result = await request.promptAsync({ authorizationEndpoint: config.authorizationEndpoint });
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Authorization was cancelled.');
  }

  const tokens = await exchangeCodeAsync(
    {
      clientId: config.clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    { tokenEndpoint: config.tokenEndpoint }
  );

  await saveConnection(config.connection, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
  });
}

/** Valid access token for API calls, refreshing when expired (IF-5). */
export async function getAccessToken(config: OAuthProviderConfig): Promise<string> {
  const stored = await loadConnection<OAuthTokens>(config.connection);
  if (!stored) {
    throw new Error('Service is not connected. Open Settings → Calendar & Reminders.');
  }
  if (Date.now() < stored.expiresAt - 60_000) return stored.accessToken;

  if (!stored.refreshToken) {
    throw new Error('Session expired — reconnect the service in Settings.');
  }
  try {
    const refreshed = await refreshAsync(
      { clientId: config.clientId!, refreshToken: stored.refreshToken },
      { tokenEndpoint: config.tokenEndpoint }
    );
    await saveConnection(config.connection, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? stored.refreshToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
    });
    return refreshed.accessToken;
  } catch {
    throw new Error('Token was revoked or expired — reconnect the service in Settings (IF-5).');
  }
}
