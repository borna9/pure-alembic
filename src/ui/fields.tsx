// Small form primitives shared across the app. Dates and times are typed
// as text (YYYY-MM-DD / HH:MM) so one implementation works on iOS,
// Android, and web without native picker dependencies.

import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarPicker } from './CalendarPicker';
import { colors } from './theme';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, props.multiline && styles.multiline]}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      placeholderTextColor={colors.subtext}
      multiline={props.multiline}
    />
  );
}

const parseNumeric = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Numeric input accepting decimals (e.g. 7.5 hours). The typed text is
 * kept as local state so partial entries like "7." survive re-renders;
 * the parsed number is propagated on every change.
 */
export function NumberField(props: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [text, setText] = useState(props.value === 0 ? '' : String(props.value));

  // Adopt external changes (draft reset, clamping) without clobbering typing.
  useEffect(() => {
    if (parseNumeric(text) !== props.value) {
      setText(props.value === 0 ? '' : String(props.value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  return (
    <TextInput
      style={styles.input}
      value={text}
      onChangeText={(t) => {
        if (!/^\d*[.,]?\d*$/.test(t)) return; // digits with one decimal separator
        setText(t);
        props.onChange(parseNumeric(t));
      }}
      placeholder={props.placeholder ?? '0'}
      placeholderTextColor={colors.subtext}
      keyboardType="decimal-pad"
      inputMode="decimal"
    />
  );
}

export const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function DateField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Selectable range for the calendar (e.g. the planning window, FR-4). */
  minDate?: string;
  maxDate?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const invalid = props.value.length > 0 && !isValidDate(props.value);
  return (
    <View>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateInput, invalid && styles.invalid]}
          value={props.value}
          onChangeText={props.onChange}
          placeholder={props.placeholder ?? 'YYYY-MM-DD'}
          placeholderTextColor={colors.subtext}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setPickerOpen(true)}
        />
        <Pressable
          style={[styles.calendarToggle, pickerOpen && styles.calendarToggleActive]}
          onPress={() => setPickerOpen((o) => !o)}
          hitSlop={6}
          accessibilityLabel="Open date picker"
        >
          <Ionicons name="calendar" size={20} color={pickerOpen ? '#fff' : colors.accent} />
        </Pressable>
      </View>
      {pickerOpen && (
        <CalendarPicker
          value={props.value}
          minDate={props.minDate}
          maxDate={props.maxDate}
          onSelect={(date) => {
            props.onChange(date);
            setPickerOpen(false);
          }}
        />
      )}
    </View>
  );
}

export function TimeField(props: { value: string; onChange: (v: string) => void }) {
  const invalid = props.value.length > 0 && !isValidTime(props.value);
  return (
    <TextInput
      style={[styles.input, invalid && styles.invalid]}
      value={props.value}
      onChangeText={props.onChange}
      placeholder="HH:MM (optional)"
      placeholderTextColor={colors.subtext}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

/** Single-select chip row (priorities, task types, repeat intervals…). */
export function Segmented<T extends string>(props: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  allowClear?: boolean;
  onClear?: () => void;
}) {
  return (
    <View style={styles.chips}>
      {props.options.map((o) => {
        const active = props.value === o;
        return (
          <Pressable
            key={o}
            onPress={() => (active && props.allowClear ? props.onClear?.() : props.onChange(o))}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const kind = props.kind ?? 'primary';
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[
        styles.button,
        kind === 'secondary' && styles.buttonSecondary,
        kind === 'danger' && styles.buttonDanger,
        props.disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          kind === 'secondary' && styles.buttonTextSecondary,
        ]}
      >
        {props.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.card,
    color: colors.text,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  invalid: { borderColor: colors.danger },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, minWidth: 0, width: 0 },
  calendarToggle: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: 9,
    backgroundColor: colors.card,
  },
  calendarToggleActive: { backgroundColor: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: colors.accent },
});
