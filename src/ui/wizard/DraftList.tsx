import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DraftBase } from '../../domain/planning';
import { colors } from '../theme';

export function DraftList(props: {
  drafts: (DraftBase & { detail?: string })[];
  onRemove: (localId: string) => void;
  emptyText: string;
}) {
  if (props.drafts.length === 0) {
    return <Text style={styles.empty}>{props.emptyText}</Text>;
  }
  return (
    <View style={styles.list}>
      {props.drafts.map((d) => (
        <View key={d.localId} style={styles.row}>
          <View style={styles.texts}>
            <Text style={styles.desc}>{d.description}</Text>
            <Text style={styles.meta}>
              {d.priority}
              {d.dayFraction ? ` · ${d.dayFraction} day` : d.hours > 0 ? ` · ${d.hours}h` : ''}
              {d.tagNames.length ? ` · ${d.tagNames.join(', ')}` : ''}
              {d.detail ? ` · ${d.detail}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => props.onRemove(d.localId)} hitSlop={8}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
  },
  texts: { flex: 1 },
  desc: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  remove: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.subtext, fontSize: 13, marginBottom: 16 },
});
