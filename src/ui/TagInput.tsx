// FR-6 / DR-5: tag entry with type-ahead. Existing tags of the batch's
// category are offered; unmatched input becomes a new tag, associated
// with that category automatically at commit.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDataStore } from '../store/dataStore';
import { Field } from './fields';
import { TypeAhead } from './TypeAhead';
import { colors } from './theme';

export function TagInput(props: {
  categoryId: string | null;
  tagNames: string[];
  onChange: (tagNames: string[]) => void;
}) {
  const tags = useDataStore((s) => s.tags);
  const options = Object.values(tags)
    .filter((t) => !t._deleted && (!props.categoryId || t.categoryId === props.categoryId))
    .map((t) => ({ id: t.id, name: t.name }));

  const add = (name: string) => {
    if (!props.tagNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      props.onChange([...props.tagNames, name]);
    }
  };

  return (
    <Field label="Tags">
      {props.tagNames.length > 0 && (
        <View style={styles.selected}>
          {props.tagNames.map((name) => (
            <Pressable
              key={name}
              style={styles.tag}
              onPress={() => props.onChange(props.tagNames.filter((n) => n !== name))}
            >
              <Text style={styles.tagText}>{name} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TypeAhead
        placeholder="Type to add tags"
        options={options}
        onSelect={(o) => add(o.name)}
        onCreate={add}
        createLabel={(name) => `New tag “${name}”`}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
});
