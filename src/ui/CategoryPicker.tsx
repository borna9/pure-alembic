// FR-13/FR-16/FR-20: pick the task category for a phase's batch of tasks,
// with select-or-create semantics (DR-6).

import { StyleSheet, Text, View } from 'react-native';
import { useDataStore } from '../store/dataStore';
import { Field } from './fields';
import { TypeAhead } from './TypeAhead';
import { colors } from './theme';

export function CategoryPicker(props: {
  label?: string;
  categoryId: string | null;
  onChange: (categoryId: string) => void;
}) {
  const categories = useDataStore((s) => s.categories);
  const createCategory = useDataStore((s) => s.createCategory);
  const current = props.categoryId ? categories[props.categoryId] : null;

  return (
    <Field label={props.label ?? 'Task category'}>
      {current ? <Text style={styles.current}>Selected: {current.name}</Text> : null}
      <TypeAhead
        placeholder={current ? 'Change category…' : 'Type to find or create a category'}
        options={Object.values(categories)
          .filter((c) => !c._deleted)
          .map((c) => ({ id: c.id, name: c.name }))}
        onSelect={(o) => props.onChange(o.id)}
        onCreate={(name) => props.onChange(createCategory(name).id)}
        createLabel={(name) => `Create category “${name}”`}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  current: { fontSize: 14, fontWeight: '600', color: colors.accent, marginBottom: 6 },
});
