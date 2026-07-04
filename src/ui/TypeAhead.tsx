// DR-5 / DR-6: type-ahead select-or-create. As the user types, matching
// existing names narrow; a non-matching final input creates a new entry.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';

export interface TypeAheadOption {
  id: string;
  name: string;
  hint?: string;
}

export function TypeAhead(props: {
  placeholder: string;
  options: TypeAheadOption[];
  onSelect: (option: TypeAheadOption) => void;
  /** Called when the typed name matches no existing option. */
  onCreate: (name: string) => void;
  createLabel?: (name: string) => string;
}) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const matches = useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    return props.options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 6);
  }, [props.options, trimmed]);

  const exact = matches.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());

  const choose = (o: TypeAheadOption) => {
    props.onSelect(o);
    setQuery('');
  };
  const createNew = () => {
    if (!trimmed) return;
    props.onCreate(trimmed);
    setQuery('');
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={props.placeholder}
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => {
          const exactMatch = matches.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
          if (exactMatch) choose(exactMatch);
          else createNew();
        }}
      />
      {trimmed.length > 0 && (
        <View style={styles.dropdown}>
          {matches.map((o) => (
            <Pressable key={o.id} style={styles.option} onPress={() => choose(o)}>
              <Text style={styles.optionText}>{o.name}</Text>
              {o.hint ? <Text style={styles.hint}>{o.hint}</Text> : null}
            </Pressable>
          ))}
          {!exact && (
            <Pressable style={styles.option} onPress={createNew}>
              <Text style={styles.create}>
                {props.createLabel ? props.createLabel(trimmed) : `Create “${trimmed}”`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: colors.card,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionText: { fontSize: 14, color: colors.text },
  hint: { fontSize: 12, color: colors.subtext },
  create: { fontSize: 14, color: colors.accent, fontWeight: '600' },
});
