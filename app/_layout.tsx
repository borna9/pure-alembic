// Pure Alembic — Life Reflection and Planning Tool
// Copyright (C) 2026 Borna <borna@firststirrings.com>
// Licensed under the GNU AGPL v3.0 only. See LICENSE.

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { registerAutoSync } from '../src/sync/engine';

export default function RootLayout() {
  // NFR-3: changes made offline sync automatically when connectivity returns.
  useEffect(() => registerAutoSync(), []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings/profile" options={{ title: 'Profile & Account' }} />
        <Stack.Screen name="settings/planning" options={{ title: 'Planning Settings' }} />
        <Stack.Screen name="settings/services" options={{ title: 'Calendar & Reminders' }} />
        <Stack.Screen name="conflicts" options={{ title: 'Sync Conflicts' }} />
        <Stack.Screen name="sessions" options={{ title: 'Planning Sessions' }} />
      </Stack>
    </>
  );
}
