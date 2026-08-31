// Planning sessions: list, resume, archive-and-start-new, delete.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  archiveAndStartNew,
  deleteSession,
  listSessions,
  SessionSummary,
  switchToSession,
} from '../src/services/sessionManager';
import { isBackendConfigured } from '../src/supabase/client';
import { Button } from '../src/ui/fields';
import { colors } from '../src/ui/theme';

export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isBackendConfigured()) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Managing multiple sessions requires the cloud backend. The current session still works
          offline on this device.
        </Text>
      </View>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Each planning session is saved to your account. Resume one on any signed-in device; the
        current session is saved automatically before switching. Sessions sync when you press
        “Sync now” (Profile) or when connectivity returns.
      </Text>
      <Button
        title="Save current & start a new session"
        disabled={busy}
        onPress={() =>
          run(async () => {
            await archiveAndStartNew();
            router.back();
          })
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {sessions === null ? (
        <Text style={styles.loading}>Loading sessions…</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.loading}>No sessions in the cloud yet — sync once to upload the current one.</Text>
      ) : (
        sessions.map((s) => (
          <View key={s.id} style={[styles.card, s.isActive && styles.cardActive]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardName}>
                {s.name || (s.windowStart ? `${s.windowStart} → ${s.windowEnd}` : 'Untitled session')}
              </Text>
              {s.isActive ? <Text style={styles.badge}>Active</Text> : null}
            </View>
            <Text style={styles.cardMeta}>
              {s.windowStart ? `${s.windowStart} → ${s.windowEnd} · ` : ''}
              updated {s.updatedAt.slice(0, 16).replace('T', ' ')}
            </Text>
            <View style={styles.actions}>
              {!s.isActive && (
                <View style={styles.action}>
                  <Button
                    title="Resume"
                    kind="secondary"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await switchToSession(s.id);
                        router.back();
                      })
                    }
                  />
                </View>
              )}
              <View style={styles.action}>
                <Button
                  title="Delete"
                  kind="danger"
                  disabled={busy}
                  onPress={() =>
                    confirmDelete(s.name || s.windowStart || 'this session', () =>
                      run(() => deleteSession(s.id))
                    )
                  }
                />
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function confirmDelete(label: string, onConfirm: () => void) {
  const message = 'Deletes the session and its drafts from all devices. Committed tasks are not affected.';
  if (Platform.OS === 'web') {
    if (window.confirm(`Delete “${label}”?\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(`Delete “${label}”?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 14 },
  loading: { fontSize: 13, color: colors.subtext, marginTop: 16 },
  error: { fontSize: 13, color: colors.danger, marginTop: 10 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'transparent' },
  cardActive: { borderColor: colors.accent },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  cardMeta: { fontSize: 12, color: colors.subtext, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  action: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 13, color: colors.subtext, textAlign: 'center', lineHeight: 18 },
});
