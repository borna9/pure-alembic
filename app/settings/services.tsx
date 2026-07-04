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
import { Button } from '../../src/ui/fields';
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
          onDisconnect={async () => {
            if (r.connection) await clearConnection(r.connection);
            if (settings.reminderService === r.kind) settings.setReminderService(null);
            refresh();
          }}
        />
      ))}
    </ScrollView>
  );
}

function ServiceCard(props: {
  row: ServiceRow<string>;
  active: boolean;
  connected: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  const { row, active, connected } = props;
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
      <View style={styles.actions}>
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
});
