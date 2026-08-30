// Screen 1 wizard steps — SRS §4.2.
// WindowStep (FR-4), RoutineStep (Phase A), KnownStep (Phase B),
// FlexibleStep (Phases C and D share one component).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FlexibleDraft, KnownDateDraft, KnownDateMode } from '../../domain/planning';
import { REPEAT_INTERVALS, RepeatInterval, TASK_TYPES, TaskType } from '../../domain/types';
import { compareDates, isWithin } from '../../logic/dates';
import { usePlanningSession } from '../../store/planningSession';
import { CategoryPicker } from '../CategoryPicker';
import { Button, DateField, Field, isValidDate, isValidTime, NumberField, Segmented, TimeField } from '../fields';
import { DraftForm } from './DraftForm';
import { DraftList } from './DraftList';
import { colors } from '../theme';

export function StepHeading(props: { title: string; sub: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.sub}>{props.sub}</Text>
    </View>
  );
}

// ---- FR-4: planning window ------------------------------------------------

export function WindowStep() {
  const s = usePlanningSession();
  const [start, setStart] = useState(s.windowStart);
  const [end, setEnd] = useState(s.windowEnd);
  const valid = isValidDate(start) && isValidDate(end) && compareDates(start, end) <= 0;

  return (
    <View>
      <StepHeading
        title="Planning window"
        sub="Choose the start and end date of the period you are planning. Every date in this session must fall inside it."
      />
      <Field label="Start date">
        <DateField value={start} onChange={setStart} />
      </Field>
      <Field label="End date">
        <DateField value={end} onChange={setEnd} />
      </Field>
      {!valid && start && end ? (
        <Text style={styles.error}>Enter valid dates (YYYY-MM-DD) with the start not after the end.</Text>
      ) : null}
      <Button
        title="Start planning"
        disabled={!valid}
        onPress={() => {
          s.setWindow(start, end);
          s.next();
        }}
      />
    </View>
  );
}

// ---- Phase A: daily routines (FR-11/FR-12) --------------------------------

export function RoutineStep() {
  const s = usePlanningSession();
  return (
    <View>
      <StepHeading
        title="Phase A — Daily routines"
        sub={`Tasks carried out every day from ${s.windowStart} to ${s.windowEnd}. One instance is created per day.`}
      />
      <CategoryPicker categoryId={s.routineCategoryId} onChange={(id) => s.setCategory('routineCategoryId', id)} />
      <DraftList
        drafts={s.routineDrafts}
        onRemove={(id) => s.removeDraft('routineDrafts', id)}
        emptyText="No daily routines yet — add one below, or continue."
      />
      <DraftForm categoryId={s.routineCategoryId} onAdd={(d) => s.addRoutine(d)} addLabel="Add daily routine" />
    </View>
  );
}

// ---- Phase B: tasks with known dates (FR-13..FR-15) ------------------------

const MODE_LABELS: Record<KnownDateMode, string> = {
  range: 'Start & end date',
  dueOnly: 'Due date only',
  weekly: 'Weekly',
  monthly: 'Monthly',
};
const MODES = Object.keys(MODE_LABELS) as KnownDateMode[];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function KnownStep() {
  const s = usePlanningSession();
  const [mode, setMode] = useState<KnownDateMode>('dueOnly');
  const [taskType, setTaskType] = useState<TaskType>('Scheduled');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [weekday, setWeekday] = useState<string>('Monday');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [knownOccurrences, setKnownOccurrences] = useState(0); // 0 = whole window

  const inWindow = (d: string) => isValidDate(d) && isWithin(d, s.windowStart, s.windowEnd);

  const validate = (): string | null => {
    if (startTime && !isValidTime(startTime)) return 'Start time must be HH:MM.';
    switch (mode) {
      case 'range':
        if (!inWindow(startDate) || !inWindow(endDate)) return 'Start and end dates must be valid and inside the planning window (FR-4).';
        if (compareDates(startDate, endDate) > 0) return 'Start date must not be after the end date.';
        return null;
      case 'dueOnly':
        return inWindow(dueDate) ? null : 'Due date must be valid and inside the planning window (FR-4).';
      case 'weekly':
        return null;
      case 'monthly':
        return dayOfMonth >= 1 && dayOfMonth <= 31 ? null : 'Day of month must be 1–31.';
    }
  };

  return (
    <View>
      <StepHeading
        title="Phase B — Tasks with known dates"
        sub="Tasks whose dates you already know: a date range, a due date, or a weekly/monthly recurrence."
      />
      <CategoryPicker categoryId={s.knownCategoryId} onChange={(id) => s.setCategory('knownCategoryId', id)} />
      <DraftList
        drafts={s.knownDrafts.map((d) => ({ ...d, detail: describeKnown(d) }))}
        onRemove={(id) => s.removeDraft('knownDrafts', id)}
        emptyText="No dated tasks yet."
      />
      <DraftForm
        categoryId={s.knownCategoryId}
        validate={validate}
        onAdd={(base) => {
          const draft: KnownDateDraft = {
            ...base,
            taskType,
            mode,
            startDate: mode === 'range' ? startDate : undefined,
            endDate: mode === 'range' ? endDate : undefined,
            dueDate: mode === 'dueOnly' ? dueDate : undefined,
            weekday: mode === 'weekly' ? WEEKDAYS.indexOf(weekday) : undefined,
            dayOfMonth: mode === 'monthly' ? dayOfMonth : undefined,
            startTime: startTime || undefined,
            occurrenceCount:
              (mode === 'weekly' || mode === 'monthly') && knownOccurrences >= 1
                ? Math.round(knownOccurrences)
                : undefined,
          };
          s.addKnown(draft);
          setStartDate('');
          setEndDate('');
          setDueDate('');
          setStartTime('');
          setKnownOccurrences(0);
        }}
      >
        <Field label="Dates">
          <Segmented
            options={MODES.map((m) => MODE_LABELS[m]) as readonly string[]}
            value={MODE_LABELS[mode]}
            onChange={(label) => setMode(MODES.find((m) => MODE_LABELS[m] === label)!)}
          />
        </Field>
        {mode === 'range' && (
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Start date">
                <DateField value={startDate} onChange={setStartDate} minDate={s.windowStart} maxDate={s.windowEnd} />
              </Field>
            </View>
            <View style={styles.half}>
              <Field label="End date">
                <DateField value={endDate} onChange={setEndDate} minDate={s.windowStart} maxDate={s.windowEnd} />
              </Field>
            </View>
          </View>
        )}
        {mode === 'dueOnly' && (
          <Field label="Due date">
            <DateField value={dueDate} onChange={setDueDate} minDate={s.windowStart} maxDate={s.windowEnd} />
          </Field>
        )}
        {mode === 'weekly' && (
          <Field label="Day of the week">
            <Segmented options={WEEKDAYS} value={weekday} onChange={setWeekday} />
          </Field>
        )}
        {mode === 'monthly' && (
          <Field label="Day of the month (1–31)">
            <NumberField value={dayOfMonth} onChange={(v) => setDayOfMonth(Math.round(v))} />
          </Field>
        )}
        {(mode === 'weekly' || mode === 'monthly') && (
          <Field label="Number of occurrences (optional — empty covers the whole window)">
            <NumberField value={knownOccurrences} onChange={setKnownOccurrences} placeholder="all" />
          </Field>
        )}
        <Field label="Start time (optional)">
          <TimeField value={startTime} onChange={setStartTime} />
        </Field>
        <Field label="Task type">
          <Segmented<TaskType> options={TASK_TYPES} value={taskType} onChange={setTaskType} />
        </Field>
      </DraftForm>
    </View>
  );
}

function describeKnown(d: KnownDateDraft): string {
  switch (d.mode) {
    case 'range':
      return `${d.startDate} → ${d.endDate}`;
    case 'dueOnly':
      return `due ${d.dueDate}`;
    case 'weekly':
      return `every ${WEEKDAYS[d.weekday ?? 0]}${d.occurrenceCount ? ` × ${d.occurrenceCount}` : ''}`;
    case 'monthly':
      return `monthly on day ${d.dayOfMonth}${d.occurrenceCount ? ` × ${d.occurrenceCount}` : ''}`;
  }
}

// ---- Phases C & D: flexible tasks (FR-16..FR-23) ----------------------------

const BOUND_MODES = ['Until a date', 'Number of times'] as const;
type BoundMode = (typeof BOUND_MODES)[number];

export function FlexibleStep(props: { phase: 'schedule' | 'block' }) {
  const s = usePlanningSession();
  const isC = props.phase === 'schedule';
  const categoryKey = isC ? 'scheduleCategoryId' : 'blockCategoryId';
  const listKey = isC ? 'scheduleDrafts' : 'blockDrafts';
  const [earliest, setEarliest] = useState('');
  const [latest, setLatest] = useState('');
  const [repeat, setRepeat] = useState<RepeatInterval>('No repeat');
  const [startTime, setStartTime] = useState('');
  const [boundMode, setBoundMode] = useState<BoundMode>('Until a date');
  const [occurrences, setOccurrences] = useState(0);

  // Count mode only applies to repeating tasks.
  const countMode = repeat !== 'No repeat' && boundMode === 'Number of times';

  const inWindow = (d: string) => isValidDate(d) && isWithin(d, s.windowStart, s.windowEnd);
  const validate = (): string | null => {
    if (!inWindow(earliest)) return 'Earliest date must be valid and inside the planning window (FR-4).';
    if (countMode) {
      if (occurrences < 1) return 'Enter how many times the task should occur (at least 1).';
    } else {
      if (!inWindow(latest)) return 'Latest date must be valid and inside the planning window (FR-4).';
      if (compareDates(earliest, latest) > 0) return 'Earliest date must not be after the latest date.';
    }
    if (startTime && !isValidTime(startTime)) return 'Start time must be HH:MM.';
    return null;
  };

  return (
    <View>
      <StepHeading
        title={isC ? 'Phase C — Tasks that need to be scheduled' : 'Phase D — Time to block off'}
        sub={
          isC
            ? 'Tasks with no fixed date. The app will spread them evenly across the window, highest priority first, without overloading any day.'
            : 'Time you want blocked off. Scheduled with the same even-spread rules as Phase C.'
        }
      />
      <CategoryPicker categoryId={s[categoryKey]} onChange={(id) => s.setCategory(categoryKey, id)} />
      <DraftList
        drafts={s[listKey].map((d) => ({
          ...d,
          detail: d.occurrenceCount
            ? `from ${d.earliest} · ${d.repeat} × ${d.occurrenceCount}`
            : `${d.earliest} → ${d.latest}${d.repeat !== 'No repeat' ? ` · ${d.repeat}` : ''}`,
        }))}
        onRemove={(id) => s.removeDraft(listKey, id)}
        emptyText={isC ? 'No tasks to schedule yet.' : 'No time blocks yet.'}
      />
      <DraftForm
        categoryId={s[categoryKey]}
        validate={validate}
        onAdd={(base) => {
          const draft: FlexibleDraft = {
            ...base,
            earliest,
            // Count mode: occurrences run from the earliest date and are
            // bounded by the window end instead of an explicit latest date.
            latest: countMode ? s.windowEnd : latest,
            repeat,
            startTime: startTime || undefined,
            occurrenceCount: countMode ? Math.round(occurrences) : undefined,
          };
          if (isC) s.addSchedule(draft);
          else s.addBlock(draft);
          setEarliest('');
          setLatest('');
          setRepeat('No repeat');
          setStartTime('');
          setBoundMode('Until a date');
          setOccurrences(0);
        }}
      >
        <Field label="Repeat">
          <Segmented<RepeatInterval> options={REPEAT_INTERVALS} value={repeat} onChange={setRepeat} />
        </Field>
        {repeat !== 'No repeat' && (
          <Field label="Repeat until">
            <Segmented options={BOUND_MODES} value={boundMode} onChange={setBoundMode} />
          </Field>
        )}
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label={repeat === 'No repeat' ? 'Earliest date' : 'First occurrence'}>
              <DateField value={earliest} onChange={setEarliest} minDate={s.windowStart} maxDate={s.windowEnd} />
            </Field>
          </View>
          <View style={styles.half}>
            {countMode ? (
              <Field label="Occurrences">
                <NumberField value={occurrences} onChange={setOccurrences} placeholder="e.g. 4" />
              </Field>
            ) : (
              <Field label="Latest date">
                <DateField value={latest} onChange={setLatest} minDate={s.windowStart} maxDate={s.windowEnd} />
              </Field>
            )}
          </View>
        </View>
        <Field label="Start time (optional)">
          <TimeField value={startTime} onChange={setStartTime} />
        </Field>
      </DraftForm>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.subtext, marginTop: 4, lineHeight: 18 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  error: { color: colors.danger, marginBottom: 10, fontSize: 13 },
});
