// Phase E — review and commit (FR-24..FR-28). All newly created tasks
// are listed for review and editing before anything is persisted.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GeneratedTask } from '../../domain/planning';
import { PRIORITIES, Priority } from '../../domain/types';
import { generatePlan } from '../../logic/planGeneration';
import { commitPlan, CommitResult } from '../../services/commitPlan';
import { usePlanningSession } from '../../store/planningSession';
import { useSettingsStore } from '../../store/settingsStore';
import { Button, DateField, Field, isValidDate, NumberField, Segmented, TextField } from '../fields';
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

  const tasks = useMemo(
    () =>
      generated.tasks
        .filter((t) => !removed.has(t.localId))
        .map((t) => ({ ...t, ...edits[t.localId] }))
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [generated, edits, removed]
  );

  const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
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

      {tasks.map((t) => {
        const isOpen = expanded === t.localId;
        return (
          <View key={t.localId} style={[styles.row, t.overCapacity && styles.rowOver]}>
            <Pressable onPress={() => setExpanded(isOpen ? null : t.localId)}>
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

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  rowOver: { borderWidth: 1, borderColor: colors.warning },
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
