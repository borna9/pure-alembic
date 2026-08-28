// Cross-platform calendar picker used by DateField. Pure React Native —
// one implementation for iOS, Android, and web (no native modules).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ISODate } from '../domain/types';
import { daysInMonth, dayOfWeek, isWithin, parseISODate, toISODate } from '../logic/dates';
import { colors } from './theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayISO(): ISODate {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function CalendarPicker(props: {
  value: string;
  onSelect: (date: ISODate) => void;
  minDate?: ISODate;
  maxDate?: ISODate;
}) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(props.value)
    ? props.value
    : props.minDate ?? todayISO();
  const { y, m } = parseISODate(anchor);
  const [viewYear, setViewYear] = useState(y);
  const [viewMonth, setViewMonth] = useState(m); // 1-12

  const shiftMonth = (delta: number) => {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth((total % 12 + 12) % 12 + 1);
  };

  const selectable = (date: ISODate) =>
    isWithin(date, props.minDate ?? '0000-01-01', props.maxDate ?? '9999-12-31');

  const today = todayISO();
  const count = daysInMonth(viewYear, viewMonth);
  const firstWeekday = dayOfWeek(toISODate(viewYear, viewMonth, 1));
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: count }, (_, i) => toISODate(viewYear, viewMonth, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-12)} hitSlop={8}>
          <Text style={styles.nav}>«</Text>
        </Pressable>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS[viewMonth - 1]} {viewYear}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
        <Pressable onPress={() => shiftMonth(12)} hitSlop={8}>
          <Text style={styles.nav}>»</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((date, i) => {
            if (!date) return <View key={i} style={styles.day} />;
            const enabled = selectable(date);
            const selected = date === props.value;
            const isToday = date === today;
            return (
              <Pressable
                key={i}
                style={[styles.day, selected && styles.daySelected]}
                disabled={!enabled}
                onPress={() => props.onSelect(date)}
              >
                <Text
                  style={[
                    styles.dayText,
                    !enabled && styles.dayDisabled,
                    isToday && !selected && styles.dayToday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {parseISODate(date).d}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    padding: 10,
    marginTop: 6,
    maxWidth: 340,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { fontSize: 18, color: colors.accent, paddingHorizontal: 10, fontWeight: '600' },
  monthTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.subtext, paddingVertical: 4 },
  day: { flex: 1, aspectRatio: 1.3, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontSize: 13, color: colors.text },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayToday: { color: colors.accent, fontWeight: '700' },
  dayDisabled: { color: colors.border },
});
