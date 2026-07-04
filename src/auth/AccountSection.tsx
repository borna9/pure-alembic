// Account section of the profile screen (§6.4). Shows sign-in options
// when the Supabase backend is configured, otherwise explains how to
// enable sync. Fully offline use never requires an account (NFR-2).

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../ui/theme';
import { isBackendConfigured } from '../supabase/client';
import { SignedInAccount, SignInButtons } from './AccountControls';
import { useAuth } from './useAuth';

export function AccountSection() {
  if (!isBackendConfigured()) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>
          Cloud sync is not configured in this build. The app works fully offline; to enable
          accounts and cross-device sync, set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY (see docs/SETUP.md) and rebuild.
        </Text>
      </View>
    );
  }
  return <AccountInner />;
}

function AccountInner() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>Checking session…</Text>
      </View>
    );
  }
  return session ? <SignedInAccount session={session} /> : <SignInButtons />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  text: { fontSize: 13, color: colors.subtext, lineHeight: 18 },
});
