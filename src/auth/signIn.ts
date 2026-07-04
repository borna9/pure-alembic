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

export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  const supabase = getSupabase();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  // Native: open the provider's page in an auth session and complete the
  // PKCE exchange from the redirect URL.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }
}

/** ACC-3: link an additional identity provider to the signed-in account. */
export async function linkProvider(provider: SocialProvider): Promise<void> {
  const supabase = getSupabase();
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
}
