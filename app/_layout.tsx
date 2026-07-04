// Pure Alembic — Life Reflection and Planning Tool
// Copyright (C) 2026 Borna <borna@firststirrings.com>
// Licensed under the GNU AGPL v3.0 only. See LICENSE.

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings/profile" options={{ title: 'Profile & Account' }} />
        <Stack.Screen name="settings/planning" options={{ title: 'Planning Settings' }} />
        <Stack.Screen name="settings/services" options={{ title: 'Calendar & Reminders' }} />
      </Stack>
    </>
  );
}
