// Profile & account — FR-31, §6.4. Sign-in methods, remote sign-out and
// account deletion appear once the app is connected to its cloud backend.

import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSettingsStore } from '../../src/store/settingsStore';
import { exportData } from '../../src/services/exportData';
import { Button, Field, TextField } from '../../src/ui/fields';
import { AccountSection } from '../../src/auth/AccountSection';
import { colors } from '../../src/ui/theme';

export default function ProfileSettings() {
  const s = useSettingsStore();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Field label="Display name">
        <TextField value={s.displayName} onChange={(displayName) => s.setProfile({ displayName })} placeholder="Your name" />
      </Field>
      <Field label="Username">
        <TextField value={s.username} onChange={(username) => s.setProfile({ username })} placeholder="username" />
      </Field>

      <Text style={styles.section}>Your data</Text>
      <Button title="Export my data (JSON)" kind="secondary" onPress={exportData} />
      <Text style={styles.hint}>
        Exports all tasks, tags, categories, and settings in a machine-readable format.
      </Text>

      <Text style={styles.section}>Account & sync</Text>
      <AccountSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
  hint: { fontSize: 12, color: colors.subtext, marginTop: 8, lineHeight: 17 },
});
