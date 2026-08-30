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
import { useDataStore } from '../../store/dataStore';
import { FilterChip } from '../FilterChip';
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

  // FR-24: user edits overlay the generated tasks. The overlay lives in
  // the persisted session store so it survives step navigation, tab
  // switches, and app restarts — not just this component's lifetime.
  const edits = session.reviewEdits;
  const removed = useMemo(() => new Set(session.reviewRemoved), [session.reviewRemoved]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  // Multi-select: checkboxes for bulk delete and bulk field override.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // True while the bulk editor has touched-but-unapplied fields; commit
  // is blocked so those changes cannot be silently dropped.
  const [bulkDirty, setBulkDirty] = useState(false);
  // Last row tapped in select mode — the anchor for range selection.
  const [anchorId, setAnchorId] = useState<string | null>(null);
  // Display filters: hide routines / categories / tags from the LIST.
  // Hidden tasks are still part of the plan and are still committed.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideRoutines, setHideRoutines] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const categories = useDataStore((st) => st.categories);

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

  const isHidden = (t: GeneratedTask) =>
    (hideRoutines && t.taskType === 'Daily routine') ||
    (t.categoryId != null && hiddenCategories.has(t.categoryId)) ||
    t.tagNames.some((n) => hiddenTags.has(n));
  const visibleTasks = useMemo(
    () => tasks.filter((t) => !isHidden(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, hideRoutines, hiddenCategories, hiddenTags]
  );
  const hiddenCount = tasks.length - visibleTasks.length;
  // Filter options come from the plan itself.
  const planCategoryIds = useMemo(
    () => [...new Set(tasks.map((t) => t.categoryId).filter((c): c is string => c != null))],
    [tasks]
  );
  const planTagNames = useMemo(() => [...new Set(tasks.flatMap((t) => t.tagNames))], [tasks]);

  if (result) {
    return (
      <View>
        <StepHeading title="Plan committed" sub="Your planning session is saved." />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLine}>{result.created} tasks created</Text>
          <Text style={styles.summaryLine}>{result.calendarEvents} calendar events</Text>
          <Text style={styles.summaryLine}>{result.reminders} reminders</Text>
          {result.calendarEvents === 0 && result.reminders === 0 && result.pushErrors.length === 0 ? (
            <Text style={styles.hint}>
              No calendar or reminder service is active yet — tasks are stored in the app. Connect a
              service under Settings → Calendar & Reminders, then use “Send committed tasks to
              services” there to deliver them.
            </Text>
          ) : null}
          {result.pushErrors.length > 0 ? (
            <Text style={styles.bulkError}>
              {result.pushErrors.length} task{result.pushErrors.length > 1 ? 's' : ''} could not be
              delivered: {result.pushErrors[0]}
              {result.pushErrors.length > 1 ? ` (+${result.pushErrors.length - 1} more)` : ''}
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

  const edit = (id: string, patch: Partial<GeneratedTask>) => session.editReview([id], patch);

  // Rendered both above the task list and below it, for long plans.
  const commitControls = (
    <View style={styles.commitBlock}>
      {bulkOpen && bulkDirty && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            The bulk editor has unapplied changes — press “Apply” there (or close it) before
            committing, so they aren’t lost.
          </Text>
        </View>
      )}
      <Button
        title={busy ? 'Committing…' : `Commit ${tasks.length} tasks`}
        disabled={busy || (bulkOpen && bulkDirty) || tasks.some((t) => !isValidDate(t.dueDate))}
        onPress={async () => {
          setBusy(true);
          setCommitError(null);
          try {
            setResult(await commitPlan(tasks));
          } catch (e) {
            setCommitError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {commitError ? <Text style={styles.bulkError}>Commit failed: {commitError}</Text> : null}
    </View>
  );

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
    const ids = visibleTasks.map((t) => t.localId);
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
        sub={`${tasks.length} tasks · ${totalHours} planned hours${hiddenCount > 0 ? ` · showing ${visibleTasks.length} of ${tasks.length}` : ''}. Tap a task to edit it before committing.`}
      />
      {overCount > 0 && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {overCount} task{overCount > 1 ? 's' : ''} could not fit under the daily hour cap
            (available hours − daily routines) and may overload their day.
          </Text>
        </View>
      )}

      {tasks.length > 0 && commitControls}

      {tasks.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolbarButton, selectMode && styles.toolbarButtonActive]}
            onPress={() => {
              setSelectMode(!selectMode);
              setSelected(new Set());
              setBulkOpen(false);
              setBulkDirty(false);
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
                  selected.size === visibleTasks.length
                    ? new Set()
                    : new Set(visibleTasks.map((t) => t.localId))
                )
              }
            >
              <Text style={styles.toolbarText}>
                {selected.size === visibleTasks.length ? 'Clear all' : 'Select all'}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.toolbarButton, (filtersOpen || hiddenCount > 0) && styles.toolbarButtonActive]}
            onPress={() => setFiltersOpen(!filtersOpen)}
          >
            <Ionicons
              name="funnel-outline"
              size={16}
              color={filtersOpen || hiddenCount > 0 ? '#fff' : colors.accent}
            />
            <Text style={[styles.toolbarText, (filtersOpen || hiddenCount > 0) && styles.toolbarTextActive]}>
              {hiddenCount > 0 ? `Filters (${hiddenCount} hidden)` : 'Filters'}
            </Text>
          </Pressable>
          {selectMode && <Text style={styles.selectedCount}>{selected.size} selected</Text>}
        </View>
      )}

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>
            Hide from the list (hidden tasks are still committed)
          </Text>
          <View style={styles.filterChips}>
            <FilterChip
              label="Daily routines"
              active={hideRoutines}
              onPress={() => setHideRoutines(!hideRoutines)}
            />
          </View>
          {planCategoryIds.length > 0 && (
            <>
              <Text style={styles.filterGroup}>Categories</Text>
              <View style={styles.filterChips}>
                {planCategoryIds.map((id) => (
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
          {planTagNames.length > 0 && (
            <>
              <Text style={styles.filterGroup}>Tags</Text>
              <View style={styles.filterChips}>
                {planTagNames.map((name) => (
                  <FilterChip
                    key={name}
                    label={name}
                    active={hiddenTags.has(name)}
                    onPress={() =>
                      setHiddenTags((s) => {
                        const next = new Set(s);
                        if (next.has(name)) next.delete(name);
                        else next.add(name);
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
                session.removeReview([...selected]);
                setSelected(new Set());
                setBulkOpen(false);
                setBulkDirty(false);
              }}
            />
          </View>
          <View style={styles.bulkAction}>
            <Button
              title={bulkOpen ? 'Close bulk edit' : `Edit ${selected.size} tasks`}
              kind="secondary"
              onPress={() => {
                setBulkOpen(!bulkOpen);
                setBulkDirty(false);
              }}
            />
          </View>
        </View>
      )}

      {selectMode && bulkOpen && selected.size > 0 && (
        <BulkEditor
          key={[...selected].sort().join(',')}
          tasks={tasks.filter((t) => selected.has(t.localId))}
          onDirtyChange={setBulkDirty}
          onApply={(patch) => {
            session.editReview([...selected], patch);
            setBulkOpen(false);
            setBulkDirty(false);
          }}
        />
      )}

      {visibleTasks.map((t) => {
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
                    setBulkDirty(false);
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
                <Button
                  title="Remove this task"
                  kind="danger"
                  onPress={() => session.removeReview([t.localId])}
                />
              </View>
            )}
          </View>
        );
      })}

      {tasks.length === 0 ? (
        <Text style={styles.hint}>Nothing to commit — go back and add tasks in the earlier phases.</Text>
      ) : (
        commitControls
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
  /** Reports whether there are touched-but-unapplied fields. */
  onDirtyChange?: (dirty: boolean) => void;
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

  const touch = (field: string) => {
    setTouched((s) => new Set(s).add(field));
    props.onDirtyChange?.(true);
  };
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
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  occurrencesTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  occurrenceRange: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  occurrenceRangeField: { flex: 1, minWidth: 150 },
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
  commitBlock: { marginBottom: 12 },
  filterPanel: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  filterTitle: { fontSize: 12, color: colors.subtext, marginBottom: 8 },
  filterGroup: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 6 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
