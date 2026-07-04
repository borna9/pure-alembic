// Screen 1 — guided planning session container (SRS §4.2).

import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlanningSession, WIZARD_STEPS, WizardStep } from '../../store/planningSession';
import { Button } from '../fields';
import { ReviewStep } from './ReviewStep';
import { FlexibleStep, KnownStep, RoutineStep, WindowStep } from './steps';
import { colors } from '../theme';

const STEP_LABELS: Record<WizardStep, string> = {
  window: 'Window',
  routines: 'A · Routines',
  known: 'B · Dated',
  schedule: 'C · Schedule',
  block: 'D · Block',
  review: 'E · Review',
};

export function PlanningWizard() {
  const s = usePlanningSession();

  if (!s.started) {
    return (
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Plan the weeks ahead</Text>
        <Text style={styles.introText}>
          A guided session: set a planning window, define daily routines, add tasks with known
          dates, let the app schedule the rest, then review everything and commit it to your
          calendar and reminders.
        </Text>
        <Button title="Start a planning session" onPress={s.start} />
      </View>
    );
  }

  const stepIndex = WIZARD_STEPS.indexOf(s.step);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stepBar}>
        {WIZARD_STEPS.map((step, i) => {
          const active = step === s.step;
          const reachable = i <= stepIndex || Boolean(s.windowStart);
          return (
            <Pressable key={step} disabled={!reachable} onPress={() => s.goTo(step)} style={styles.stepTab}>
              <Text style={[styles.stepText, active && styles.stepTextActive, !reachable && styles.stepTextDisabled]}>
                {STEP_LABELS[step]}
              </Text>
              <View style={[styles.stepLine, active && styles.stepLineActive]} />
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {s.step === 'window' && <WindowStep />}
        {s.step === 'routines' && <RoutineStep />}
        {s.step === 'known' && <KnownStep />}
        {s.step === 'schedule' && <FlexibleStep phase="schedule" />}
        {s.step === 'block' && <FlexibleStep phase="block" />}
        {s.step === 'review' && <ReviewStep />}

        {s.step !== 'window' && (
          <View style={styles.navRow}>
            <View style={styles.navButton}>
              <Button title="Back" kind="secondary" onPress={s.back} />
            </View>
            {s.step !== 'review' && (
              <View style={styles.navButton}>
                <Button title="Continue" onPress={s.next} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  intro: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background },
  introTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  introText: { fontSize: 14, color: colors.subtext, lineHeight: 20 },
  stepBar: { flexDirection: 'row', backgroundColor: colors.card, paddingTop: 8 },
  stepTab: { flex: 1, alignItems: 'center' },
  stepText: { fontSize: 11, fontWeight: '600', color: colors.subtext, marginBottom: 6 },
  stepTextActive: { color: colors.accent },
  stepTextDisabled: { color: colors.border },
  stepLine: { height: 3, alignSelf: 'stretch', backgroundColor: 'transparent' },
  stepLineActive: { backgroundColor: colors.accent },
  content: { padding: 16, paddingBottom: 48 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  navButton: { flex: 1 },
});
