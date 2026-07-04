import type { ReminderProvider } from '../types';

// Implemented in the provider integration pass.
export const appleEventKitReminderProvider: ReminderProvider = {
  async createReminder() {
    throw new Error('This reminder service is not yet connected. Open Settings to connect it.');
  },
};
