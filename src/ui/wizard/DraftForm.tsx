// Common per-task entry form — SRS §4.2.2 (FR-5..FR-10).
// Phase-specific fields (dates, repeat, type…) are injected as children.

import { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DraftBase } from '../../domain/planning';
import { PRIORITIES, Priority } from '../../domain/types';
import { DAY_FRACTIONS, DayFraction } from '../../logic/hours';
import { Button, Field, NumberField, Segmented, TextField } from '../fields';
import { TagInput } from '../TagInput';
import { colors } from '../theme';

let draftSeq = 0;

export interface DraftFormValue extends DraftBase {}

export function emptyDraft(): DraftFormValue {
  return {
    localId: `draft-${Date.now()}-${++draftSeq}`,
    description: '',
    priority: 'Medium', // DR-2 default
    tagNames: [],
    notes: '',
    hours: 0, // FR-5 default
    dayFraction: null,
    prepHours: 0,
    followUpHours: 0,
  };
}

export function DraftForm(props: {
  categoryId: string | null;
  showPriority?: boolean; // FR-15/FR-18/FR-22: user selects priority
  /** Hidden for daily routines — they are auto-tagged "Daily routine". */
  showTags?: boolean;
  addLabel?: string;
  /** Phase-specific fields rendered between description and hours. */
  children?: ReactNode;
  /** Return an error message to block submission, or null to accept. */
  validate?: () => string | null;
  onAdd: (draft: DraftFormValue) => void;
  onDraftChange?: (draft: DraftFormValue) => void;
}) {
  const [draft, setDraft] = useState<DraftFormValue>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<DraftFormValue>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    props.onDraftChange?.(next);
  };

  const submit = () => {
    if (!draft.description.trim()) {
      setError('Enter a description.');
      return;
    }
    const external = props.validate?.() ?? null;
    if (external) {
      setError(external);
      return;
    }
    setError(null);
    props.onAdd({ ...draft, description: draft.description.trim() });
    const fresh = emptyDraft();
    setDraft(fresh);
    props.onDraftChange?.(fresh);
  };

  return (
    <View style={styles.form}>
      <Field label="Description">
        <TextField value={draft.description} onChange={(v) => update({ description: v })} placeholder="What is the task?" />
      </Field>

      {props.children}

      {props.showPriority !== false && (
        <Field label="Priority">
          <Segmented<Priority> options={PRIORITIES} value={draft.priority} onChange={(priority) => update({ priority })} />
        </Field>
      )}

      <Field label="Hours — enter a number or pick a day fraction (FR-5)">
        <View style={styles.hoursRow}>
          <View style={styles.hoursInput}>
            <NumberField
              value={draft.dayFraction ? 0 : draft.hours}
              onChange={(hours) => update({ hours, dayFraction: null })}
              placeholder="Hours"
            />
          </View>
          <Segmented<DayFraction>
            options={DAY_FRACTIONS}
            value={draft.dayFraction}
            onChange={(dayFraction) => update({ dayFraction })}
            allowClear
            onClear={() => update({ dayFraction: null })}
          />
        </View>
        {draft.dayFraction ? (
          <Text style={styles.note}>
            {draft.dayFraction} of the hours still available on the task’s day.
          </Text>
        ) : null}
      </Field>

      {props.showTags !== false && (
        <TagInput categoryId={props.categoryId} tagNames={draft.tagNames} onChange={(tagNames) => update({ tagNames })} />
      )}

      <Field label="Notes">
        <TextField value={draft.notes} onChange={(v) => update({ notes: v })} multiline placeholder="Optional notes" />
      </Field>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label="Preparation hours">
            <NumberField value={draft.prepHours} onChange={(prepHours) => update({ prepHours })} />
          </Field>
        </View>
        <View style={styles.half}>
          <Field label="Follow-up hours">
            <NumberField value={draft.followUpHours} onChange={(followUpHours) => update({ followUpHours })} />
          </Field>
        </View>
      </View>
      <Text style={styles.note}>
        Preparation/follow-up hours create an extra blocked-time task one week before/after this one.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={props.addLabel ?? 'Add task'} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 16 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hoursInput: { width: 90 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  note: { fontSize: 12, color: colors.subtext, marginTop: 6, marginBottom: 10 },
  error: { color: colors.danger, marginBottom: 10, fontSize: 13 },
});
