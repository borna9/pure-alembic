// Review-before-send for committed tasks that have not been delivered
// to external services yet (no external link, FR-28): pick which to
// send, or delete stale ones outright. Interim tool until Screen 2
// (View/modify & sync items) is specified.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pushTasksToServices } from '../providers/push';
import { StoredTask, useDataStore } from '../store/dataStore';
import { Button } from './fields';
import { colors } from './theme';

function confirmDialog(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export function DeliveryManager() {
  const tasks = useDataStore((s) => s.tasks);
  const deleteTask = useDataStore((s) => s.deleteTask);

  const undelivered = useMemo(
    () =>
      Object.values(tasks)
        .filter((t) => !t._deleted && !t.externalLink)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [tasks]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Default to everything selected once the store has loaded; afterwards
  // only prune ids that disappeared (sent or deleted).
  useEffect(() => {
    if (!initialized && undelivered.length > 0) {
      setSelected(new Set(undelivered.map((t) => t.id)));
      setInitialized(true);
    } else {
      setSelected((s) => {
        const ids = new Set(undelivered.map((t) => t.id));
        return new Set([...s].filter((id) => ids.has(id)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undelivered.length]);

  if (undelivered.length === 0) {
    return (
      <Text style={styles.empty}>
        {message ?? 'All committed tasks have been delivered — nothing waiting.'}
      </Text>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const toSend = undelivered.filter((t) => selected.has(t.id));
      const r = await pushTasksToServices(toSend, (done, total) =>
        setMessage(`Sending ${done} of ${total}…`)
      );
      setMessage(
        `${r.calendarEvents} calendar event${r.calendarEvents === 1 ? '' : 's'} and ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} created.` +
          (r.errors.length > 0 ? ` ${r.errors.length} failed: ${r.errors[0]}` : '')
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = () =>
    confirmDialog(
      `Delete ${selected.size} tasks?`,
      'Removes them from the app (and from cloud sync). They will not be sent to any service.',
      () => {
        for (const id of selected) deleteTask(id);
        setMessage(`${selected.size} tasks deleted.`);
      }
    );

  return (
    <View>
      <View style={styles.headRow}>
        <Pressable
          onPress={() =>
            setSelected(
              selected.size === undelivered.length
                ? new Set()
                : new Set(undelivered.map((t) => t.id))
            )
          }
        >
          <Text style={styles.selectAll}>
            {selected.size === undelivered.length ? 'Clear all' : 'Select all'}
          </Text>
        </Pressable>
        <Text style={styles.count}>
          {selected.size} of {undelivered.length} selected
        </Text>
      </View>

      {undelivered.map((t) => (
        <Row key={t.id} task={t} selected={selected.has(t.id)} onToggle={() => toggle(t.id)} />
      ))}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title={busy ? 'Sending…' : `Send ${selected.size} to services`}
            disabled={busy || selected.size === 0}
            onPress={send}
          />
        </View>
        <View style={styles.action}>
          <Button
            title={`Delete ${selected.size}`}
            kind="danger"
            disabled={busy || selected.size === 0}
            onPress={removeSelected}
          />
        </View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

function Row(props: { task: StoredTask; selected: boolean; onToggle: () => void }) {
  const { task } = props;
  return (
    <Pressable style={styles.row} onPress={props.onToggle}>
      <Ionicons
        name={props.selected ? 'checkbox' : 'square-outline'}
        size={20}
        color={props.selected ? colors.accent : colors.border}
        style={styles.checkbox}
      />
      <View style={styles.texts}>
        <Text style={styles.desc} numberOfLines={1}>
          {task.description}
        </Text>
        <Text style={styles.meta}>
          {task.dueDate}
          {task.hours > 0 ? ` · ${task.hours}h` : ''}
          {task.startTime ? ` · ${task.startTime}` : ''} · {task.taskType}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectAll: { fontSize: 13, fontWeight: '600', color: colors.accent },
  count: { fontSize: 12, color: colors.subtext },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  checkbox: { marginRight: 8 },
  texts: { flex: 1, minWidth: 0 },
  desc: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.subtext, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  action: { flex: 1 },
  message: { fontSize: 13, color: colors.accent, marginTop: 10, lineHeight: 18 },
  empty: { fontSize: 13, color: colors.subtext, lineHeight: 18 },
});
