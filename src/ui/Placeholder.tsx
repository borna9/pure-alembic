import { StyleSheet, Text, View } from 'react-native';

// FR-3 / FR-29: Screens 2-7 are blank placeholder pages in this version [OI-1].
export function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>This screen will be specified in a future version.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  note: { fontSize: 14, color: '#888' },
});
