// Calendar & reminder service configuration — FR-34, §5.
// One calendar service and one reminder service can be active at a time.

import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CalendarServiceKind,
  ReminderServiceKind,
  useSettingsStore,
} from '../../src/store/settingsStore';
import { clearConnection, ConnectionKey, isConnected } from '../../src/providers/connections';
import { connectCaldav, connectService } from '../../src/providers/connect';
import { Button, Field, TextField } from '../../src/ui/fields';
import { colors } from '../../src/ui/theme';

const isIOS = Platform.OS === 'ios';

interface ServiceRow<K extends string> {
  kind: K;
  name: string;
  detail: string;
  /** Connection credential slot; null = OS permission only (EventKit). */
  connection: ConnectionKey | null;
  available: boolean;
}

const CALENDARS: ServiceRow<CalendarServiceKind>[] = [
  { kind: 'google', name: 'Google Calendar', detail: 'OAuth 2.0 with PKCE', connection: 'google', available: true },
  { kind: 'microsoft', name: 'Outlook / Office 365', detail: 'Microsoft Graph, OAuth 2.0 with PKCE', connection: 'microsoft', available: true },
  { kind: 'apple-eventkit', name: 'iCloud Calendar (this device)', detail: 'EventKit — OS permission, no credentials', connection: null, available: isIOS },
  { kind: 'icloud-caldav', name: 'iCloud Calendar (CalDAV)', detail: 'Apple ID + app-specific password', connection: 'icloud-caldav', available: !isIOS },
];

const REMINDERS: ServiceRow<ReminderServiceKind>[] = [
  { kind: 'apple-eventkit', name: 'Apple Reminders (this device)', detail: 'EventKit — OS permission, no credentials', connection: null, available: isIOS },
  { kind: 'microsoft-todo', name: 'Microsoft To Do', detail: 'Microsoft Graph, OAuth 2.0 with PKCE', connection: 'microsoft', available: true },
  { kind: 'apple-caldav', name: 'Apple Reminders (CalDAV)', detail: 'Apple ID + app-specific password', connection: 'icloud-caldav', available: !isIOS },
];

export default function ServicesSettings() {
  const settings = useSettingsStore();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const state: Record<string, boolean> = {};
    for (const k of ['google', 'microsoft', 'icloud-caldav'] as ConnectionKey[]) {
      state[k] = await isConnected(k);
    }
    setConnected(state);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        On commit, tasks with a date and hours become events in your calendar service; all other
        tasks become items in your reminder service. Connecting a service requires the app to be
        configured with API credentials — see docs/SETUP.md in the repository.
      </Text>

      <Text style={styles.section}>Calendar service</Text>
      {CALENDARS.filter((c) => c.available).map((c) => (
        <ServiceCard
          key={c.kind}
          row={c}
          active={settings.calendarService === c.kind}
          connected={c.connection ? !!connected[c.connection] : true}
          onSelect={() => settings.setCalendarService(c.kind)}
          onConnected={() => {
            // Connecting implies wanting to use it — activate automatically.
            settings.setCalendarService(c.kind);
            refresh();
          }}
          onDisconnect={async () => {
            if (c.connection) await clearConnection(c.connection);
            if (settings.calendarService === c.kind) settings.setCalendarService(null);
            refresh();
          }}
        />
      ))}

      <Text style={styles.section}>Reminder service</Text>
      {REMINDERS.filter((r) => r.available).map((r) => (
        <ServiceCard
          key={r.kind}
          row={r}
          active={settings.reminderService === r.kind}
          connected={r.connection ? !!connected[r.connection] : true}
          onSelect={() => settings.setReminderService(r.kind)}
          onConnected={() => {
            settings.setReminderService(r.kind);
            refresh();
          }}
          onDisconnect={async () => {
            if (r.connection) await clearConnection(r.connection);
            if (settings.reminderService === r.kind) settings.setReminderService(null);
            refresh();
          }}
        />
      ))}

      <Text style={styles.section}>Delivery</Text>
      <Text style={styles.intro}>
        Committed tasks that have not been delivered yet (for example, committed before a service
        was connected) can be sent now. Tasks with a date and hours become calendar events;
        everything else becomes reminders.
      </Text>
      <Button
        title={pushBusy ? 'Sending…' : 'Send committed tasks to services'}
        disabled={pushBusy}
        onPress={async () => {
          setPushBusy(true);
          setPushMessage(null);
          try {
            const { pushUnlinkedTasks } = await import('../../src/providers/push');
            const r = await pushUnlinkedTasks();
            setPushMessage(
              `${r.calendarEvents} calendar event${r.calendarEvents === 1 ? '' : 's'} and ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} created.` +
                (r.errors.length > 0 ? ` ${r.errors.length} failed: ${r.errors[0]}` : '')
            );
          } catch (e) {
            setPushMessage(e instanceof Error ? e.message : String(e));
          } finally {
            setPushBusy(false);
          }
        }}
      />
      {pushMessage ? <Text style={styles.pushMessage}>{pushMessage}</Text> : null}
    </ScrollView>
  );
}

function ServiceCard(props: {
  row: ServiceRow<string>;
  active: boolean;
  connected: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
  onConnected?: () => void;
}) {
  const { row, active, connected } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCaldav = row.connection === 'icloud-caldav';
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isCaldav) {
        if (!appleId || !appPassword) throw new Error('Enter your Apple ID and app-specific password.');
        await connectCaldav(appleId.trim(), appPassword.trim());
        setAppPassword('');
      } else {
        await connectService(row.kind as CalendarServiceKind | ReminderServiceKind);
      }
      props.onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName}>{row.name}</Text>
        {active ? <Text style={styles.badge}>Active</Text> : null}
      </View>
      <Text style={styles.cardDetail}>{row.detail}</Text>
      <Text style={[styles.status, connected ? styles.statusOk : styles.statusOff]}>
        {connected ? 'Connected' : 'Not connected'}
      </Text>

      {!connected && isCaldav && (
        <View style={styles.caldavForm}>
          <Field label="Apple ID (email)">
            <TextField value={appleId} onChange={setAppleId} placeholder="you@icloud.com" />
          </Field>
          <Field label="App-specific password (from appleid.apple.com)">
            <TextField value={appPassword} onChange={setAppPassword} placeholder="xxxx-xxxx-xxxx-xxxx" />
          </Field>
        </View>
      )}

      <View style={styles.actions}>
        {!connected && (
          <View style={styles.actionButton}>
            <Button title={busy ? 'Connecting…' : 'Connect'} disabled={busy} onPress={connect} />
          </View>
        )}
        {!active && (
          <View style={styles.actionButton}>
            <Button title="Use this service" kind="secondary" onPress={props.onSelect} />
          </View>
        )}
        {active && row.connection && connected && (
          <View style={styles.actionButton}>
            <Button title="Disconnect" kind="danger" onPress={props.onDisconnect} />
          </View>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 16 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  cardActive: { borderColor: colors.accent },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text },
  badge: { fontSize: 11, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  cardDetail: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  statusOk: { color: '#2e7d32' },
  statusOff: { color: colors.subtext },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: { flex: 1 },
  caldavForm: { marginTop: 10 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 8 },
  pushMessage: { fontSize: 13, color: colors.accent, marginTop: 10, lineHeight: 18 },
});
