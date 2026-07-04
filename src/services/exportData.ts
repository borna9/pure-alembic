// ACC-5: export of the user's data in a machine-readable format.

import { Platform, Share } from 'react-native';
import { useDataStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export function buildExport(): string {
  const data = useDataStore.getState();
  const settings = useSettingsStore.getState();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      application: 'Pure Alembic',
      settings: {
        displayName: settings.displayName,
        username: settings.username,
        availableHoursPerDay: settings.availableHoursPerDay,
        cycleStarts: settings.cycleStarts,
      },
      categories: Object.values(data.categories).filter((c) => !c._deleted),
      tags: Object.values(data.tags).filter((t) => !t._deleted),
      tasks: Object.values(data.tasks).filter((t) => !t._deleted),
    },
    null,
    2
  );
}

export async function exportData(): Promise<void> {
  const json = buildExport();
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pure-alembic-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ message: json, title: 'Pure Alembic data export' });
  }
}
