// Phase E — review and commit (FR-24..FR-28). All newly created tasks
// are listed for review and editing before anything is persisted.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GeneratedTask } from '../../domain/planning';
import { PRIORITIES, Priority, TASK_TYPES, TaskType } from '../../domain/types';
import { isWithin } from '../../logic/dates';
import { generatePlan } from '../../logic/planGeneration';
import { commitPlan, CommitResult } from '../../services/commitPlan';
import { usePlanningSession } from '../../store/planningSession';
import { useSettingsStore } from '../../store/settingsStore';
import { Button, DateField, Field, isValidDate, isValidTime, NumberField, Segmented, TextField, TimeField } from '../fields';
import { StepHeading } from './steps';
import { colors } from '../theme';

export function ReviewStep() {
  const session = usePlanningSession();
  const availableHoursPerDay = useSettingsStore((s) => s.availableHoursPerDay);

  const generated = useMemo(
    () => generatePlan(session, availableHoursPerDay),
    // Regenerate only when the drafts or window change.
    [
      session.windowStart,
      session.windowEnd,
      session.routineDrafts,
      session.knownDrafts,
      session.scheduleDrafts,
      session.blockDrafts,
      availableHoursPerDay,
    ]
  );

  // FR-24: user edits overlay the generated tasks.
  const [edits, setEdits] = useState<Record<string, Partial<GeneratedTask>>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Multi-select: checkboxes for bulk delete and bulk field override.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // Last row tapped in select mode — the anchor for range selection.
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const tasks = useMemo(
    () =>
      generated.tasks
        .filter((t) => !removed.has(t.localId))
        .map((t) => ({ ...t, ...edits[t.localId] }))
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [generated, edits, removed]
  );

  const totalHours = Math.round(tasks.reduce((sum, t) => sum + t.hours, 0) * 100) / 100;
  const overCount = tasks.filter((t) => t.overCapacity).length;

  if (result) {
    return (
      <View>
        <StepHeading title="Plan committed" sub="Your planning session is saved." />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLine}>{result.created} tasks created</Text>
          <Text style={styles.summaryLine}>{result.calendarEvents} calendar events</Text>
          <Text style={styles.summaryLine}>{result.reminders} reminders</Text>
          {result.calendarEvents === 0 && result.reminders === 0 ? (
            <Text style={styles.hint}>
              No calendar or reminder service is connected yet — tasks are stored in the app. Connect
              services under Settings → Calendar & Reminders.
            </Text>
          ) : null}
        </View>
        <Button
          title="Start a new planning session"
          onPress={() => {
            setResult(null);
            session.reset();
          }}
        />
      </View>
    );
  }

  const edit = (id: string, patch: Partial<GeneratedTask>) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchorId(id);
  };

  // Range gesture (Shift-click on web, long-press on touch): every row
  // between the anchor and the pressed row takes the anchor's current
  // selection state — so it both selects and deselects ranges.
  const rangeTo = (id: string) => {
    if (!anchorId || anchorId === id) {
      toggleOne(id);
      return;
    }
    const ids = tasks.map((t) => t.localId);
    const a = ids.indexOf(anchorId);
    const b = ids.indexOf(id);
    if (a === -1 || b === -1) {
      toggleOne(id);
      return;
    }
    const state = selected.has(anchorId);
    setSelected((s) => {
      const next = new Set(s);
      for (const rowId of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) {
        if (state) next.add(rowId);
        else next.delete(rowId);
      }
      return next;
    });
    setAnchorId(id);
  };

  return (
    <View>
      <StepHeading
        title="Phase E — Review & commit"
        sub={`${tasks.length} tasks · ${totalHours} planned hours. Tap a task to edit it before committing.`}
      />
      {overCount > 0 && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {overCount} task{overCount > 1 ? 's' : ''} could not fit under the daily hour cap
            (available hours − daily routines) and may overload their day.
          </Text>
        </View>
      )}

      {tasks.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolbarButton, selectMode && styles.toolbarButtonActive]}
            onPress={() => {
              setSelectMode(!selectMode);
              setSelected(new Set());
              setBulkOpen(false);
              setExpanded(null);
              setAnchorId(null);
            }}
          >
            <Ionicons name="checkbox-outline" size={16} color={selectMode ? '#fff' : colors.accent} />
            <Text style={[styles.toolbarText, selectMode && styles.toolbarTextActive]}>
              {selectMode ? 'Done selecting' : 'Select tasks'}
            </Text>
          </Pressable>
          {selectMode && (
            <Pressable
              style={styles.toolbarButton}
              onPress={() =>
                setSelected(
                  selected.size === tasks.length
                    ? new Set()
                    : new Set(tasks.map((t) => t.localId))
                )
              }
            >
              <Text style={styles.toolbarText}>
                {selected.size === tasks.length ? 'Clear all' : 'Select all'}
              </Text>
            </Pressable>
          )}
          {selectMode && <Text style={styles.selectedCount}>{selected.size} selected</Text>}
        </View>
      )}

      {selectMode && (
        <Text style={styles.rangeHint}>
          Tap to select · long-press (or Shift-click) to extend a range from the last tapped task
        </Text>
      )}

      {selectMode && selected.size > 0 && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkAction}>
            <Button
              title={`Delete ${selected.size}`}
              kind="danger"
              onPress={() => {
                setRemoved((r) => new Set([...r, ...selected]));
                setSelected(new Set());
                setBulkOpen(false);
              }}
            />
          </View>
          <View style={styles.bulkAction}>
            <Button
              title={bulkOpen ? 'Close bulk edit' : `Edit ${selected.size} tasks`}
              kind="secondary"
              onPress={() => setBulkOpen(!bulkOpen)}
            />
          </View>
        </View>
      )}

      {selectMode && bulkOpen && selected.size > 0 && (
        <BulkEditor
          key={[...selected].sort().join(',')}
          tasks={tasks.filter((t) => selected.has(t.localId))}
          onApply={(patch) => {
            setEdits((e) => {
              const next = { ...e };
              for (const id of selected) next[id] = { ...next[id], ...patch };
              return next;
            });
            setBulkOpen(false);
          }}
        />
      )}

      {tasks.map((t) => {
        const isOpen = !selectMode && expanded === t.localId;
        const isSelected = selected.has(t.localId);
        return (
          <View
            key={t.localId}
            style={[styles.row, t.overCapacity && styles.rowOver, isSelected && styles.rowSelected]}
          >
            <Pressable
              onPress={(e) => {
                if (selectMode) {
                  const shift = Boolean(
                    (e?.nativeEvent as { shiftKey?: boolean } | undefined)?.shiftKey
                  );
                  if (shift) rangeTo(t.localId);
                  else toggleOne(t.localId);
                } else {
                  setExpanded(isOpen ? null : t.localId);
                }
              }}
              onLongPress={selectMode ? () => rangeTo(t.localId) : undefined}
              delayLongPress={350}
            >
              <View style={styles.rowBody}>
                {selectMode && (
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? colors.accent : colors.border}
                    style={styles.checkbox}
                  />
                )}
                <View style={styles.rowTexts}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowDate}>{t.dueDate}</Text>
                    <Text style={styles.rowType}>{t.taskType}</Text>
                  </View>
                  <Text style={styles.rowDesc}>{t.description}</Text>
                  <Text style={styles.rowMeta}>
                    {t.priority}
                    {t.hours > 0 ? ` · ${t.hours}h` : ''}
                    {t.startTime ? ` · ${t.startTime}` : ''}
                    {t.tagNames.length ? ` · ${t.tagNames.join(', ')}` : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
            {isOpen && (
              <View style={styles.editor}>
                <Field label="Description">
                  <TextField value={t.description} onChange={(v) => edit(t.localId, { description: v })} />
                </Field>
                <Field label="Due date">
                  <DateField value={t.dueDate} onChange={(v) => edit(t.localId, { dueDate: v })} />
                </Field>
                <Field label="Hours">
                  <NumberField value={t.hours} onChange={(v) => edit(t.localId, { hours: v })} />
                </Field>
                <Field label="Priority">
                  <Segmented<Priority> options={PRIORITIES} value={t.priority} onChange={(v) => edit(t.localId, { priority: v })} />
                </Field>
                <Button
                  title="Remove this task"
                  kind="danger"
                  onPress={() => setRemoved((r) => new Set(r).add(t.localId))}
                />
                {(() => {
                  // Occurrences of the same draft (daily routines, weekly/
                  // monthly recurrences) — prep/follow-up tasks excluded.
                  const siblings = tasks.filter(
                    (x) => x.sourceDraftId === t.sourceDraftId && !x.parentLocalId
                  );
                  if (siblings.length < 2 || t.parentLocalId) return null;
                  const pick = (ids: string[]) => {
                    setSelectMode(true);
                    setSelected(new Set(ids));
                    setAnchorId(null);
                    setExpanded(null);
                    setBulkOpen(true);
                  };
                  return (
                    <OccurrenceSelector
                      count={siblings.length}
                      windowStart={session.windowStart}
                      windowEnd={session.windowEnd}
                      onSelectAll={() => pick(siblings.map((x) => x.localId))}
                      onSelectRange={(from, to) => {
                        const ids = siblings
                          .filter((x) => isWithin(x.dueDate, from, to))
                          .map((x) => x.localId);
                        if (ids.length === 0) return false;
                        pick(ids);
                        return true;
                      }}
                    />
                  );
                })()}
              </View>
            )}
          </View>
        );
      })}

      {tasks.length === 0 ? (
        <Text style={styles.hint}>Nothing to commit — go back and add tasks in the earlier phases.</Text>
      ) : (
        <Button
          title={busy ? 'Committing…' : `Commit ${tasks.length} tasks`}
          disabled={busy || tasks.some((t) => !isValidDate(t.dueDate))}
          onPress={async () => {
            setBusy(true);
            try {
              setResult(await commitPlan(tasks));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </View>
  );
}

/**
 * Actions on a repeating task's occurrences: select them all — or just
 * those in a date range — and jump straight into the bulk editor.
 */
function OccurrenceSelector(props: {
  count: number;
  windowStart: string;
  windowEnd: string;
  onSelectAll: () => void;
  onSelectRange: (from: string, to: string) => boolean;
}) {
  const [from, setFrom] = useState(props.windowStart);
  const [to, setTo] = useState(props.windowEnd);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.occurrences}>
      <Text style={styles.occurrencesTitle}>
        This task has {props.count} occurrences in the plan
      </Text>
      <Button title={`Edit all ${props.count} occurrences`} kind="secondary" onPress={props.onSelectAll} />
      <View style={styles.occurrenceRange}>
        <View style={styles.occurrenceRangeField}>
          <Field label="From">
            <DateField value={from} onChange={setFrom} minDate={props.windowStart} maxDate={props.windowEnd} />
          </Field>
        </View>
        <View style={styles.occurrenceRangeField}>
          <Field label="To">
            <DateField value={to} onChange={setTo} minDate={props.windowStart} maxDate={props.windowEnd} />
          </Field>
        </View>
      </View>
      <Button
        title="Edit occurrences in range"
        kind="secondary"
        onPress={() => {
          if (!isValidDate(from) || !isValidDate(to) || from > to) {
            setError('Enter a valid date range (from ≤ to).');
            return;
          }
          setError(props.onSelectRange(from, to) ? null : 'No occurrences fall in that range.');
        }}
      />
      {error ? <Text style={styles.bulkError}>{error}</Text> : null}
    </View>
  );
}

/**
 * Bulk field override for the selected tasks. Fields where all selected
 * tasks agree are pre-filled; differing fields show "mixed values".
 * Only fields the user actually touches are applied — everything else
 * keeps each task's own value.
 */
function BulkEditor(props: {
  tasks: GeneratedTask[];
  onApply: (patch: Partial<GeneratedTask>) => void;
}) {
  const uniform = <K extends keyof GeneratedTask>(key: K): GeneratedTask[K] | undefined => {
    const first = props.tasks[0]?.[key];
    return props.tasks.every((t) => t[key] === first) ? first : undefined;
  };

  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [taskType, setTaskType] = useState<TaskType | null>(uniform('taskType') ?? null);
  const [priority, setPriority] = useState<Priority | null>(uniform('priority') ?? null);
  const [dueDate, setDueDate] = useState<string>(uniform('dueDate') ?? '');
  const [hours, setHours] = useState<number>(uniform('hours') ?? 0);
  const [startTime, setStartTime] = useState<string>(uniform('startTime') ?? '');
  const [error, setError] = useState<string | null>(null);

  const touch = (field: string) => setTouched((s) => new Set(s).add(field));
  const mixed = (key: keyof GeneratedTask) => uniform(key) === undefined && !touched.has(key);

  const apply = () => {
    const patch: Partial<GeneratedTask> = {};
    if (touched.has('taskType') && taskType) patch.taskType = taskType;
    if (touched.has('priority') && priority) patch.priority = priority;
    if (touched.has('dueDate')) {
      if (!isValidDate(dueDate)) {
        setError('Enter a valid due date (YYYY-MM-DD) or leave it untouched.');
        return;
      }
      patch.dueDate = dueDate;
    }
    if (touched.has('hours')) patch.hours = hours;
    if (touched.has('startTime')) {
      if (startTime && !isValidTime(startTime)) {
        setError('Start time must be HH:MM, or empty to clear it.');
        return;
      }
      patch.startTime = startTime || null;
    }
    setError(null);
    props.onApply(patch);
  };

  return (
    <View style={styles.bulkEditor}>
      <Text style={styles.bulkTitle}>
        Editing {props.tasks.length} tasks — only fields you change are overridden
      </Text>
      <Field label={`Task type${mixed('taskType') ? ' (mixed values)' : ''}`}>
        <Segmented<TaskType>
          options={TASK_TYPES}
          value={taskType}
          onChange={(v) => {
            setTaskType(v);
            touch('taskType');
          }}
        />
      </Field>
      <Field label={`Priority${mixed('priority') ? ' (mixed values)' : ''}`}>
        <Segmented<Priority>
          options={PRIORITIES}
          value={priority}
          onChange={(v) => {
            setPriority(v);
            touch('priority');
          }}
        />
      </Field>
      <Field label={`Due date${mixed('dueDate') ? ' (mixed values)' : ''}`}>
        <DateField
          value={dueDate}
          onChange={(v) => {
            setDueDate(v);
            touch('dueDate');
          }}
        />
      </Field>
      <Field label={`Hours${mixed('hours') ? ' (mixed values)' : ''}`}>
        <NumberField
          value={hours}
          onChange={(v) => {
            setHours(v);
            touch('hours');
          }}
        />
      </Field>
      <Field label={`Start time${mixed('startTime') ? ' (mixed values)' : ''}`}>
        <TimeField
          value={startTime}
          onChange={(v) => {
            setStartTime(v);
            touch('startTime');
          }}
        />
      </Field>
      {error ? <Text style={styles.bulkError}>{error}</Text> : null}
      <Button
        title={touched.size === 0 ? 'No changes yet' : `Apply to ${props.tasks.length} tasks`}
        disabled={touched.size === 0}
        onPress={apply}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  rowOver: { borderWidth: 1, borderColor: colors.warning },
  rowSelected: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rowBody: { flexDirection: 'row', alignItems: 'center' },
  rowTexts: { flex: 1 },
  checkbox: { marginRight: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  toolbarButtonActive: { backgroundColor: colors.accent },
  toolbarText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  toolbarTextActive: { color: '#fff' },
  selectedCount: { fontSize: 13, color: colors.subtext, marginLeft: 'auto' },
  rangeHint: { fontSize: 12, color: colors.subtext, marginBottom: 10 },
  occurrences: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  occurrencesTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  occurrenceRange: { flexDirection: 'row', gap: 12 },
  occurrenceRangeField: { flex: 1 },
  bulkBar: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bulkAction: { flex: 1 },
  bulkEditor: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    marginBottom: 12,
  },
  bulkTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 12 },
  bulkError: { fontSize: 13, color: colors.danger, marginBottom: 8 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  rowDate: { fontSize: 12, fontWeight: '700', color: colors.accent },
  rowType: { fontSize: 11, color: colors.subtext },
  rowDesc: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  editor: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 2 },
  warning: { backgroundColor: colors.warningSoft, borderRadius: 10, padding: 12, marginBottom: 12 },
  warningText: { color: colors.warning, fontSize: 13 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  summaryLine: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.subtext, marginBottom: 16, lineHeight: 18 },
});
