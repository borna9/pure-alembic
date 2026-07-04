// Small form primitives shared across the app. Dates and times are typed
// as text (YYYY-MM-DD / HH:MM) so one implementation works on iOS,
// Android, and web without native picker dependencies.

import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

export function NumberField(props: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <TextInput
      style={styles.input}
      value={props.value === 0 ? '' : String(props.value)}
      onChangeText={(t) => {
        const n = parseFloat(t.replace(',', '.'));
        props.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
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

export function DateField(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const invalid = props.value.length > 0 && !isValidDate(props.value);
  return (
    <TextInput
      style={[styles.input, invalid && styles.invalid]}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder ?? 'YYYY-MM-DD'}
      placeholderTextColor={colors.subtext}
      autoCapitalize="none"
      autoCorrect={false}
    />
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
