// Planning settings — FR-32 (available hours per day) and FR-33 (cycles).

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NumberField, Field } from '../../src/ui/fields';
import { useSettingsStore } from '../../src/store/settingsStore';
import { colors } from '../../src/ui/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PlanningSettings() {
  const s = useSettingsStore();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Field label="Available hours per day (FR-32)">
        <NumberField
          value={s.availableHoursPerDay}
          onChange={(v) => s.setAvailableHoursPerDay(v)}
        />
      </Field>
      <Text style={styles.hint}>
        The number of plannable hours per day (default 24). Used to compute Full/Half/Quarter-day
        hours and the daily load cap when the app schedules tasks.
      </Text>

      <Text style={styles.section}>Planning cycles</Text>
      <Text style={styles.hint}>
        The year is divided into four cycles used by cycle reflections. Each cycle starts on the
        day/month below and ends the day before the next cycle begins.
      </Text>
      {s.cycleStarts.map((c, i) => (
        <View key={i} style={styles.cycleRow}>
          <Text style={styles.cycleLabel}>Cycle {i + 1}</Text>
          <View style={styles.cycleFields}>
            <View style={styles.cycleField}>
              <Field label="Day">
                <NumberField
                  value={c.day}
                  onChange={(v) => s.setCycleStart(i, { ...c, day: clamp(Math.round(v), 1, 31) })}
                />
              </Field>
            </View>
            <View style={styles.cycleFieldWide}>
              <Field label="Month (1–12)">
                <NumberField
                  value={c.month}
                  onChange={(v) => s.setCycleStart(i, { ...c, month: clamp(Math.round(v), 1, 12) })}
                />
              </Field>
            </View>
          </View>
          <Text style={styles.cyclePreview}>{c.day} {MONTHS[c.month - 1]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v || min));

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  hint: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 16 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 8 },
  cycleRow: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  cycleLabel: { fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: 6 },
  cycleFields: { flexDirection: 'row', gap: 12 },
  cycleField: { width: 90 },
  cycleFieldWide: { flex: 1 },
  cyclePreview: { fontSize: 13, color: colors.subtext },
});
