// Conflict resolution UI (NFR-3a): both versions side by side; the user
// picks one or edits the field to combine them.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { resolveConflict } from '../src/sync/engine';
import { useConflictStore } from '../src/sync/conflictStore';
import { Button, TextField } from '../src/ui/fields';
import { colors } from '../src/ui/theme';

export default function ConflictsScreen() {
  const conflicts = useConflictStore((s) => s.conflicts);
  const list = Object.values(conflicts);

  if (list.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No conflicts</Text>
        <Text style={styles.emptyText}>Concurrent edits that need your decision will appear here.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        The same field was changed on two devices. Pick a version, or edit to combine them —
        everything else keeps syncing in the meantime.
      </Text>
      {list.map((c) => (
        <ConflictCard key={c.id} conflictId={c.id} />
      ))}
    </ScrollView>
  );
}

function ConflictCard({ conflictId }: { conflictId: string }) {
  const c = useConflictStore((s) => s.conflicts[conflictId]);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState('');
  if (!c) return null;

  const asText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

  return (
    <View style={styles.card}>
      <Text style={styles.recordLabel}>{c.recordLabel}</Text>
      <Text style={styles.fieldLabel}>Field: {c.field}</Text>

      <View style={styles.versions}>
        <Pressable style={styles.version} onPress={() => resolveConflict(c.id, c.localValue)}>
          <Text style={styles.versionTitle}>This device</Text>
          <Text style={styles.versionValue}>{asText(c.localValue)}</Text>
          <Text style={styles.versionAt}>{c.localAt.slice(0, 16).replace('T', ' ')}</Text>
          <Text style={styles.keep}>Keep this</Text>
        </Pressable>
        <Pressable style={styles.version} onPress={() => resolveConflict(c.id, c.remoteValue)}>
          <Text style={styles.versionTitle}>Other device</Text>
          <Text style={styles.versionValue}>{asText(c.remoteValue)}</Text>
          <Text style={styles.versionAt}>{c.remoteAt.slice(0, 16).replace('T', ' ')}</Text>
          <Text style={styles.keep}>Keep this</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.editRow}>
          <TextField value={edited} onChange={setEdited} placeholder="Combined value" />
          <View style={styles.editButtons}>
            <Button title="Save combined value" onPress={() => resolveConflict(c.id, edited)} />
          </View>
        </View>
      ) : (
        <Button
          title="Edit to combine"
          kind="secondary"
          onPress={() => {
            setEdited(asText(c.localValue));
            setEditing(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 14 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  recordLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 12, color: colors.subtext, marginBottom: 10 },
  versions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  version: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  versionTitle: { fontSize: 11, fontWeight: '700', color: colors.subtext, textTransform: 'uppercase' },
  versionValue: { fontSize: 14, color: colors.text, marginVertical: 6 },
  versionAt: { fontSize: 11, color: colors.subtext },
  keep: { fontSize: 13, fontWeight: '600', color: colors.accent, marginTop: 8 },
  editRow: { gap: 8 },
  editButtons: { marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.subtext, textAlign: 'center' },
});
