// Social sign-in — ACC-2: Google, Apple, or Microsoft through the
// backend's OAuth flow. The user authenticates in the provider's own
// interface (passkeys included when the provider supports them); the app
// never sees a password (IF-3).

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getSupabase } from '../supabase/client';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google' | 'apple' | 'azure';

export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  azure: 'Microsoft',
};

const redirectTo = makeRedirectUri({ scheme: 'purealembic', path: 'auth-callback' });

/**
 * Always show the provider's account chooser: the browser may hold a
 * session for a different account than the one the user wants here.
 * Google and Microsoft honor `prompt=select_account`; Apple always asks.
 */
function chooserParams(provider: SocialProvider): Record<string, string> | undefined {
  return provider === 'google' || provider === 'azure' ? { prompt: 'select_account' } : undefined;
}

export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  const supabase = getSupabase();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Return to the current page — the app may be served under a
      // subpath (GitHub Pages), so the bare origin would miss the app.
      options: { redirectTo: window.location.href, queryParams: chooserParams(provider) },
    });
    if (error) throw error;
    return;
  }

  // Native: open the provider's page in an auth session and complete the
  // PKCE exchange from the redirect URL.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true, queryParams: chooserParams(provider) },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  await exchangeFromCallback(result.url);
}

/** Complete the PKCE exchange from a native redirect URL. */
async function exchangeFromCallback(callbackUrl: string): Promise<void> {
  // Regex instead of the URL API — React Native's URL lacks searchParams.
  const code = /[?&]code=([^&#]+)/.exec(callbackUrl)?.[1];
  if (!code) {
    const err = /[?&]error_description=([^&#]+)/.exec(callbackUrl)?.[1];
    throw new Error(err ? decodeURIComponent(err) : 'Sign-in was not completed (no code returned).');
  }
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/** ACC-3: link an additional identity provider to the signed-in account. */
export async function linkProvider(provider: SocialProvider): Promise<void> {
  const supabase = getSupabase();
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.linkIdentity({
      provider,
      // Return to the current page — the app may be served under a
      // subpath (GitHub Pages), so the bare origin would miss the app.
      options: { redirectTo: window.location.href, queryParams: chooserParams(provider) },
    });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true, queryParams: chooserParams(provider) },
  });
  if (error) throw error;
  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') await exchangeFromCallback(result.url);
  }
}
