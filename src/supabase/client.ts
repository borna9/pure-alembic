// Supabase client (ACC-1: managed backend platform). The app is fully
// usable without a configured backend — cloud sync simply stays off.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isBackendConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isBackendConfigured()) {
    throw new Error('Supabase backend is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).');
  }
  client ??= createClient(url!, anonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // On web, Supabase parses the OAuth redirect from the URL itself.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}
