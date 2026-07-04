// Interactive connection flows launched from Settings (FR-34).

import { Platform } from 'react-native';
import { CalendarServiceKind, ReminderServiceKind } from '../store/settingsStore';
import { verifyCaldavConnection } from './caldav';
import { clearConnection, saveConnection } from './connections';
import { connectOAuth, GOOGLE_OAUTH, MICROSOFT_OAUTH } from './oauth';

export async function connectService(
  kind: CalendarServiceKind | ReminderServiceKind
): Promise<void> {
  switch (kind) {
    case 'google':
      await connectOAuth(GOOGLE_OAUTH);
      return;
    case 'microsoft':
    case 'microsoft-todo':
      await connectOAuth(MICROSOFT_OAUTH);
      return;
    case 'apple-eventkit': {
      // IF-4: OS permission grant only; requested again at creation time.
      if (Platform.OS !== 'ios') throw new Error('EventKit is only available on iOS.');
      const Calendar = await import('expo-calendar');
      const cal = await Calendar.requestCalendarPermissionsAsync();
      const rem = await Calendar.requestRemindersPermissionsAsync();
      if (cal.status !== 'granted' && rem.status !== 'granted') {
        throw new Error('Permission was not granted.');
      }
      return;
    }
    case 'icloud-caldav':
    case 'apple-caldav':
      throw new Error('Enter your Apple ID and app-specific password below.');
  }
}

/** Save + verify iCloud CalDAV credentials (IF-4). */
export async function connectCaldav(appleId: string, appSpecificPassword: string): Promise<void> {
  await saveConnection('icloud-caldav', { appleId, appSpecificPassword });
  try {
    await verifyCaldavConnection();
  } catch (e) {
    await clearConnection('icloud-caldav');
    throw e;
  }
}
