import { StyleSheet, Text, View } from 'react-native';

// Screen 1 — Planning for weeks or months ahead (SRS §4.2).
// The guided planning wizard is mounted here.
export default function PlanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planning</Text>
      <Text style={styles.note}>Wizard under construction.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  note: { fontSize: 14, color: '#888' },
});
