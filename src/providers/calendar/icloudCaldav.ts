import type { CalendarProvider } from '../types';

// Implemented in the provider integration pass.
export const icloudCaldavCalendarProvider: CalendarProvider = {
  async createEvent() {
    throw new Error('This calendar service is not yet connected. Open Settings to connect it.');
  },
};
