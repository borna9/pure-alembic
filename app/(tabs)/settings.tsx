import { Link } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConflictStore } from '../../src/sync/conflictStore';

// FR-30: Settings reachable at all times from the navigation bar.
const sections = [
  { href: '/sessions', icon: 'albums', title: 'Planning Sessions', sub: 'Resume, switch, or delete saved sessions' },
  { href: '/settings/profile', icon: 'person-circle', title: 'Profile & Account', sub: 'Display name, sign-in methods, export, deletion' },
  { href: '/settings/planning', icon: 'time', title: 'Planning', sub: 'Available hours per day, cycle dates' },
  { href: '/settings/services', icon: 'cloud', title: 'Calendar & Reminders', sub: 'Connect Google, Microsoft, or Apple services' },
] as const;

export default function SettingsScreen() {
  const conflictCount = useConflictStore((s) => Object.keys(s.conflicts).length);
  return (
    <View style={styles.container}>
      {conflictCount > 0 && (
        <Link href="/conflicts" asChild>
          <Pressable style={[styles.row, styles.conflictRow]}>
            <Ionicons name="warning" size={28} color="#b56a00" style={styles.icon} />
            <View style={styles.texts}>
              <Text style={styles.title}>Resolve sync conflicts</Text>
              <Text style={styles.sub}>{conflictCount} field{conflictCount > 1 ? 's' : ''} changed on two devices</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </Pressable>
        </Link>
      )}
      {sections.map((s) => (
        <Link key={s.href} href={s.href} asChild>
          <Pressable style={styles.row}>
            <Ionicons name={s.icon} size={28} color="#7C4DBE" style={styles.icon} />
            <View style={styles.texts}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.sub}>{s.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </Pressable>
        </Link>
      ))}
      <Text style={styles.build}>
        Build {(process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev').slice(0, 7)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  conflictRow: { borderWidth: 1, borderColor: '#b56a00' },
  build: { fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 'auto' },
  icon: { marginRight: 12 },
  texts: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
});
