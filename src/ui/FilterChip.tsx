// Toggle chip for show/hide filters: active = hidden, shown struck through.

import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export function FilterChip(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.chip, props.active && styles.chipActive]}
    >
      <Ionicons
        name={props.active ? 'eye-off' : 'eye'}
        size={14}
        color={props.active ? '#fff' : colors.subtext}
      />
      <Text style={[styles.text, props.active && styles.textActive]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.subtext, borderColor: colors.subtext },
  text: { fontSize: 12, color: colors.text },
  textActive: { color: '#fff', textDecorationLine: 'line-through' },
});
