// Signed-out and signed-in account controls (§6.4).
// ACC-2 sign-in options; ACC-3 identity linking/unlinking (≥1 method
// always remains); ACC-5 deletion; ACC-6 remote sign-out.

import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { getSupabase } from '../supabase/client';
import { syncNow } from '../sync/engine';
import { Button } from '../ui/fields';
import { colors } from '../ui/theme';
import { linkProvider, PROVIDER_LABELS, signInWithProvider, SocialProvider } from './signIn';

const PROVIDERS: SocialProvider[] = ['google', 'apple', 'azure'];

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export function SignInButtons() {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        Sign in to sync your data across devices. Authentication happens on the provider's own
        page — you can use a passkey there if your provider supports it. No password is ever
        created in or stored by Pure Alembic.
      </Text>
      {PROVIDERS.map((p) => (
        <View key={p} style={styles.button}>
          <Button
            title={`Sign in with ${PROVIDER_LABELS[p]}`}
            kind="secondary"
            onPress={async () => {
              try {
                setError(null);
                await signInWithProvider(p);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SignedInAccount({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabase();
  const identities = session.user.identities ?? [];

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.identity}>Signed in as {session.user.email ?? session.user.id}</Text>
      <Text style={styles.text}>
        Linked sign-in methods: {identities.map((i) => i.provider).join(', ') || 'none'}
      </Text>

      <View style={styles.button}>
        <Button title={busy ? 'Working…' : 'Sync now'} disabled={busy} onPress={() => run(async () => {
          const r = await syncNow();
          return `Synced: ${r.pushed} pushed, ${r.pulled} pulled${r.conflicts > 0 ? `, ${r.conflicts} conflicts to resolve` : ''}`;
        })} />
      </View>

      {PROVIDERS.filter((p) => !identities.some((i) => i.provider === p)).map((p) => (
        <View key={p} style={styles.button}>
          <Button
            title={`Link ${PROVIDER_LABELS[p]}`}
            kind="secondary"
            disabled={busy}
            onPress={() => run(async () => {
              await linkProvider(p);
              return `${PROVIDER_LABELS[p]} linked.`;
            })}
          />
        </View>
      ))}

      {identities.length > 1 &&
        identities.map((identity) => (
          <View key={identity.identity_id} style={styles.button}>
            <Button
              title={`Unlink ${identity.provider}`}
              kind="secondary"
              disabled={busy}
              onPress={() => run(async () => {
                // ACC-3: at least one sign-in method must always remain —
                // enforced by only offering unlink when 2+ identities exist.
                const { error } = await supabase.auth.unlinkIdentity(identity);
                if (error) throw error;
                return `${identity.provider} unlinked.`;
              })}
            />
          </View>
        ))}

      <View style={styles.button}>
        <Button title="Sign out on this device" kind="secondary" disabled={busy} onPress={() => run(async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          return null;
        })} />
      </View>
      <View style={styles.button}>
        <Button title="Sign out other devices" kind="secondary" disabled={busy} onPress={() => run(async () => {
          // ACC-6: remote sign-out of all other sessions.
          const { error } = await supabase.auth.signOut({ scope: 'others' });
          if (error) throw error;
          return 'Other devices signed out.';
        })} />
      </View>
      <View style={styles.button}>
        <Button
          title="Delete account and cloud data"
          kind="danger"
          disabled={busy}
          onPress={() =>
            confirm(
              'Delete account?',
              'This permanently removes your account and all cloud-stored data (ACC-5). Data on this device is kept until you uninstall the app.',
              () => run(async () => {
                const { error } = await supabase.functions.invoke('delete-account');
                if (error) throw error;
                await supabase.auth.signOut();
                return 'Account deleted.';
              })
            )
          }
        />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  identity: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  text: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 10 },
  button: { marginBottom: 8 },
  error: { fontSize: 13, color: colors.danger, marginTop: 6 },
  message: { fontSize: 13, color: colors.accent, marginTop: 6 },
});
