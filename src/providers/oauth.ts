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
import { Platform } from 'react-native';
import { getSupabase, isBackendConfigured } from '../supabase/client';
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
  // select_account: always show the account chooser (the browser may be
  // signed into a different Google account than the one used here);
  // consent: required with access_type=offline to obtain a refresh token.
  extraParams: { access_type: 'offline', prompt: 'select_account consent' },
};

export const MICROSOFT_OAUTH: OAuthProviderConfig = {
  connection: 'microsoft',
  clientIdEnv: 'EXPO_PUBLIC_MICROSOFT_CLIENT_ID',
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['Calendars.ReadWrite', 'Tasks.ReadWrite', 'offline_access'],
  extraParams: { prompt: 'select_account' },
};

/**
 * Web: a real app route (app/oauth-callback.tsx) that completes the auth
 * session — including under a sub-path deployment like GitHub Pages
 * (EXPO_PUBLIC_BASE_URL, set by CI). This exact URL must be registered
 * as an authorized redirect URI on the OAuth client (docs/SETUP.md).
 * Native: the custom-scheme redirect.
 */
function getRedirectUri(): string {
  if (Platform.OS === 'web') {
    const base = process.env.EXPO_PUBLIC_BASE_URL ?? '';
    return `${window.location.origin}${base}/oauth-callback`;
  }
  return makeRedirectUri({ scheme: 'purealembic', path: 'oauth' });
}

/**
 * Google requires the client secret at the token endpoint for Web
 * clients even with PKCE — the exchange runs in the google-token edge
 * function so the secret never reaches the browser (NFR-5).
 */
function usesTokenBroker(config: OAuthProviderConfig): boolean {
  return config.connection === 'google' && Platform.OS === 'web';
}

async function brokerTokenRequest(body: Record<string, string>): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}> {
  if (!isBackendConfigured()) {
    throw new Error('Google Calendar on the web needs the Supabase backend (google-token function).');
  }
  const { data, error } = await getSupabase().functions.invoke('google-token', { body });
  if (error) throw new Error(`Token exchange failed: ${error.message}`);
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`);
  return data;
}

/** Interactive connect: full PKCE round trip, tokens saved per NFR-5. */
export async function connectOAuth(config: OAuthProviderConfig): Promise<void> {
  if (!config.clientId) {
    throw new Error(
      `Missing ${config.clientIdEnv}. Register a (free) OAuth app and set it — see docs/SETUP.md.`
    );
  }

  const redirectUri = getRedirectUri();
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

  if (usesTokenBroker(config)) {
    const tokens = await brokerTokenRequest({
      grant_type: 'authorization_code',
      code: result.params.code,
      code_verifier: request.codeVerifier ?? '',
      redirect_uri: redirectUri,
    });
    await saveConnection(config.connection, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    });
    return;
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
    if (usesTokenBroker(config)) {
      const refreshed = await brokerTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken,
      });
      await saveConnection(config.connection, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? stored.refreshToken,
        expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      });
      return refreshed.access_token;
    }
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
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Token exchange failed')) throw e;
    throw new Error('Token was revoked or expired — reconnect the service in Settings (IF-5).');
  }
}
