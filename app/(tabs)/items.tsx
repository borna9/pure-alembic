// Screen 2 — View or modify and sync items. First functional version
// (the SRS left this screen unspecified, OI-1): all committed tasks,
// searchable, editable in place, with delivery status and the two-way
// calendar pull. Edits go through the field-clock path, so they sync to
// the cloud and other devices.

import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRIORITIES, Priority } from '../../src/domain/types';
import { liveTasks, StoredTask, useDataStore } from '../../src/store/dataStore';
import { CalendarPullButton } from '../../src/ui/DeliveryManager';
import { Button, DateField, Field, NumberField, Segmented, TextField, TimeField } from '../../src/ui/fields';
import { colors } from '../../src/ui/theme';

const PAGE = 100;

export default function ItemsScreen() {
  const tasks = useDataStore((s) => s.tasks);
  const updateTask = useDataStore((s) => s.updateTask);
  const deleteTask = useDataStore((s) => s.deleteTask);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(
    () => liveTasks(tasks).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [tasks]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((t) => t.description.toLowerCase().includes(q)) : all;
  }, [all, query]);
  const shown = filtered.slice(0, limit);

  if (all.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No items yet</Text>
        <Text style={styles.emptyText}>Tasks appear here after you commit a planning session.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CalendarPullButton />
      <Field label={`Search ${filtered.length} of ${all.length} items`}>
        <TextField value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Filter by description" />
      </Field>

      {shown.map((t) => (
        <ItemRow
          key={t.id}
          task={t}
          expanded={expanded === t.id}
          onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
          onEdit={(patch) => updateTask(t.id, patch)}
          onDelete={() => {
            confirmDelete(t.description, () => deleteTask(t.id));
            setExpanded(null);
          }}
        />
      ))}
      {filtered.length > limit && (
        <Button title={`Show ${Math.min(PAGE, filtered.length - limit)} more`} kind="secondary" onPress={() => setLimit(limit + PAGE)} />
      )}
    </ScrollView>
  );
}

function confirmDelete(description: string, onConfirm: () => void) {
  const message = 'Also removes it from cloud sync; its calendar event is removed on the next calendar pull.';
  if (Platform.OS === 'web') {
    if (window.confirm(`Delete “${description}”?\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(`Delete “${description}”?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function ItemRow(props: {
  task: StoredTask;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (patch: Partial<StoredTask>) => void;
  onDelete: () => void;
}) {
  const { task } = props;
  return (
    <View style={styles.row}>
      <Pressable onPress={props.onToggle}>
        <View style={styles.rowHead}>
          <Text style={styles.rowDate}>{task.dueDate}</Text>
          <View style={styles.rowBadges}>
            {task.externalLink ? (
              <Ionicons name="link" size={14} color={colors.accent} />
            ) : (
              <Ionicons name="cloud-offline-outline" size={14} color={colors.subtext} />
            )}
            <Text style={styles.rowType}>{task.taskType}</Text>
          </View>
        </View>
        <Text style={styles.rowDesc}>{task.description}</Text>
        <Text style={styles.rowMeta}>
          {task.priority}
          {task.hours > 0 ? ` · ${task.hours}h` : ''}
          {task.startTime ? ` · ${task.startTime}` : ''}
          {task.completed ? ' · done' : ''}
        </Text>
      </Pressable>
      {props.expanded && (
        <View style={styles.editor}>
          {task.externalLink ? (
            <Text style={styles.hint}>
              Delivered to your calendar/reminders. For date and time changes, prefer editing the
              calendar event and pulling — the calendar wins on conflicts.
            </Text>
          ) : null}
          <Field label="Description">
            <TextField value={task.description} onChange={(v) => props.onEdit({ description: v })} />
          </Field>
          <Field label="Due date">
            <DateField value={task.dueDate} onChange={(v) => props.onEdit({ dueDate: v })} />
          </Field>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Start time">
                <TimeField value={task.startTime ?? ''} onChange={(v) => props.onEdit({ startTime: v || null })} />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="Hours">
                <NumberField value={task.hours} onChange={(v) => props.onEdit({ hours: v })} />
              </Field>
            </View>
          </View>
          <Field label="Priority">
            <Segmented<Priority> options={PRIORITIES} value={task.priority} onChange={(v) => props.onEdit({ priority: v })} />
          </Field>
          <Field label="Completed">
            <Segmented
              options={['No', 'Yes'] as const}
              value={task.completed ? 'Yes' : 'No'}
              onChange={(v) => props.onEdit({ completed: v === 'Yes' })}
            />
          </Field>
          <Button title="Delete this item" kind="danger" onPress={props.onDelete} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  row: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  rowDate: { fontSize: 12, fontWeight: '700', color: colors.accent },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowType: { fontSize: 11, color: colors.subtext },
  rowDesc: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  editor: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 },
  hint: { fontSize: 12, color: colors.subtext, lineHeight: 17, marginBottom: 10 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.subtext, textAlign: 'center' },
});
