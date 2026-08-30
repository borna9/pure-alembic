// iCloud Calendar on iOS via EventKit (IF-4): OS-level permission grant,
// no stored credentials.

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { CalendarProvider } from '../types';
import { endTimeFrom, toLocalDate } from '../datetime';

export const appleEventKitCalendarProvider: CalendarProvider = {
  async createEvent(spec) {
    if (Platform.OS !== 'ios') {
      throw new Error('EventKit calendar access is only available on iOS.');
    }
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') throw new Error('Calendar permission was not granted.');

    const defaultCal = await Calendar.getDefaultCalendarAsync();
    const eventId = await Calendar.createEventAsync(defaultCal.id, {
      title: spec.title,
      notes: spec.notes,
      startDate: toLocalDate(spec.date, spec.startTime),
      endDate: toLocalDate(spec.date, endTimeFrom(spec.startTime, spec.hours)),
    });
    // EventKit has no shareable URL; the identifier satisfies IF-2/FR-28.
    return { url: `eventkit:${eventId}`, id: eventId };
  },
};
