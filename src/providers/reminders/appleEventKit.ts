// Apple Reminders on iOS via EventKit (IF-4).

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { ReminderProvider } from '../types';

export const appleEventKitReminderProvider: ReminderProvider = {
  async createReminder(spec) {
    if (Platform.OS !== 'ios') {
      throw new Error('EventKit reminders are only available on iOS.');
    }
    const { status } = await Calendar.requestRemindersPermissionsAsync();
    if (status !== 'granted') throw new Error('Reminders permission was not granted.');

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    const target = calendars.find((c) => c.allowsModifications) ?? calendars[0];
    if (!target) throw new Error('No Reminders list available.');

    const reminderId = await Calendar.createReminderAsync(target.id, {
      title: spec.title,
      notes: spec.notes,
    });
    return `eventkit-reminder:${reminderId}`;
  },
};
