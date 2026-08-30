// Review-before-send for committed tasks that have not been delivered
// to external services yet (no external link, FR-28): pick which to
// send, or delete stale ones outright. Interim tool until Screen 2
// (View/modify & sync items) is specified.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pushTasksToServices } from '../providers/push';
import { StoredTask, useDataStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './fields';
import { FilterChip } from './FilterChip';
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

/** Two-way calendar sync button (v1: Google Calendar). */
export function CalendarPullButton() {
  const calendarService = useSettingsStore((s) => s.calendarService);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (calendarService !== 'google') return null;

  return (
    <View style={styles.pullBlock}>
      <Button
        title={busy ? 'Checking calendar…' : 'Pull changes from calendar'}
        kind="secondary"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setMessage(null);
          try {
            const { pullCalendarChanges } = await import('../services/calendarPull');
            const r = await pullCalendarChanges((done, total) =>
              setMessage(`Checking ${done} of ${total}…`)
            );
            setMessage(
              `${r.updated} task${r.updated === 1 ? '' : 's'} updated from calendar, ${r.deletedInApp} deleted here, ${r.deletedInCalendar} event${r.deletedInCalendar === 1 ? '' : 's'} removed from calendar.` +
                (r.errors.length ? ` ${r.errors.length} failed: ${r.errors[0]}` : '')
            );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

export function DeliveryManager() {
  const tasks = useDataStore((s) => s.tasks);
  const tags = useDataStore((s) => s.tags);
  const categories = useDataStore((s) => s.categories);
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
  // Same show/hide filters as the Review step. A task's categories are
  // those of its tags (DR-4). Hidden tasks leave the selection, so what
  // is checked is exactly what gets sent.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideRoutines, setHideRoutines] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());

  const isHidden = (t: StoredTask) =>
    (hideRoutines && t.taskType === 'Daily routine') ||
    (t.tagIds ?? []).some(
      (id) => hiddenTags.has(id) || hiddenCategories.has(tags[id]?.categoryId ?? '')
    );
  const visible = useMemo(
    () => undelivered.filter((t) => !isHidden(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [undelivered, hideRoutines, hiddenCategories, hiddenTags, tags]
  );
  const hiddenCount = undelivered.length - visible.length;

  // Filter options come from the pending tasks themselves.
  const pendingTagIds = useMemo(
    () => [...new Set(undelivered.flatMap((t) => t.tagIds ?? []))].filter((id) => tags[id] && !tags[id]._deleted),
    [undelivered, tags]
  );
  const pendingCategoryIds = useMemo(
    () => [...new Set(pendingTagIds.map((id) => tags[id]?.categoryId).filter((c): c is string => Boolean(c)))],
    [pendingTagIds, tags]
  );

  // Default to everything selected once the store has loaded; afterwards
  // prune ids that disappeared (sent or deleted) or became hidden.
  useEffect(() => {
    if (!initialized && undelivered.length > 0) {
      setSelected(new Set(visible.map((t) => t.id)));
      setInitialized(true);
    } else {
      setSelected((s) => {
        const ids = new Set(visible.map((t) => t.id));
        return new Set([...s].filter((id) => ids.has(id)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undelivered.length, visible.length]);

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
      const toSend = visible.filter((t) => selected.has(t.id));
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
              selected.size === visible.length ? new Set() : new Set(visible.map((t) => t.id))
            )
          }
        >
          <Text style={styles.selectAll}>
            {selected.size === visible.length ? 'Clear all' : 'Select all'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, (filtersOpen || hiddenCount > 0) && styles.filterButtonActive]}
          onPress={() => setFiltersOpen(!filtersOpen)}
        >
          <Ionicons
            name="funnel-outline"
            size={14}
            color={filtersOpen || hiddenCount > 0 ? '#fff' : colors.accent}
          />
          <Text style={[styles.filterButtonText, (filtersOpen || hiddenCount > 0) && styles.filterButtonTextActive]}>
            {hiddenCount > 0 ? `Filters (${hiddenCount} hidden)` : 'Filters'}
          </Text>
        </Pressable>
        <Text style={styles.count}>
          {selected.size} of {visible.length} selected
        </Text>
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>Hidden tasks are not sent and not deleted</Text>
          <View style={styles.filterChips}>
            <FilterChip
              label="Daily routines"
              active={hideRoutines}
              onPress={() => setHideRoutines(!hideRoutines)}
            />
          </View>
          {pendingCategoryIds.length > 0 && (
            <>
              <Text style={styles.filterGroup}>Categories</Text>
              <View style={styles.filterChips}>
                {pendingCategoryIds.map((id) => (
                  <FilterChip
                    key={id}
                    label={categories[id]?.name ?? 'Unknown'}
                    active={hiddenCategories.has(id)}
                    onPress={() =>
                      setHiddenCategories((s) => {
                        const next = new Set(s);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                  />
                ))}
              </View>
            </>
          )}
          {pendingTagIds.length > 0 && (
            <>
              <Text style={styles.filterGroup}>Tags</Text>
              <View style={styles.filterChips}>
                {pendingTagIds.map((id) => (
                  <FilterChip
                    key={id}
                    label={tags[id]?.name ?? 'Unknown'}
                    active={hiddenTags.has(id)}
                    onPress={() =>
                      setHiddenTags((s) => {
                        const next = new Set(s);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {visible.map((t) => (
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
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  selectAll: { fontSize: 13, fontWeight: '600', color: colors.accent },
  count: { fontSize: 12, color: colors.subtext, marginLeft: 'auto' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.card,
  },
  filterButtonActive: { backgroundColor: colors.accent },
  filterButtonText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  filterButtonTextActive: { color: '#fff' },
  filterPanel: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  filterTitle: { fontSize: 12, color: colors.subtext, marginBottom: 8 },
  filterGroup: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 6 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  checkbox: { marginRight: 8 },
  texts: { flex: 1, minWidth: 0 },
  desc: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.subtext, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  action: { flex: 1 },
  message: { fontSize: 13, color: colors.accent, marginTop: 10, lineHeight: 18 },
  empty: { fontSize: 13, color: colors.subtext, lineHeight: 18 },
  pullBlock: { marginBottom: 14 },
});
