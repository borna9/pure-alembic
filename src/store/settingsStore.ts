// User settings — SRS §4.4 (FR-31..FR-34).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CycleStart,
  DEFAULT_AVAILABLE_HOURS_PER_DAY,
  DEFAULT_CYCLE_STARTS,
} from '../domain/types';

export type CalendarServiceKind = 'google' | 'microsoft' | 'apple-eventkit' | 'icloud-caldav';
export type ReminderServiceKind = 'apple-eventkit' | 'microsoft-todo' | 'apple-caldav';

interface SettingsState {
  displayName: string;
  username: string;
  availableHoursPerDay: number; // FR-32, default 24
  cycleStarts: CycleStart[]; // FR-33, four cycles
  calendarService: CalendarServiceKind | null; // FR-34: one calendar service
  reminderService: ReminderServiceKind | null; // FR-34: one reminder service

  setProfile: (p: { displayName?: string; username?: string }) => void;
  setAvailableHoursPerDay: (hours: number) => void;
  setCycleStart: (index: number, start: CycleStart) => void;
  setCalendarService: (s: CalendarServiceKind | null) => void;
  setReminderService: (s: ReminderServiceKind | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      displayName: '',
      username: '',
      availableHoursPerDay: DEFAULT_AVAILABLE_HOURS_PER_DAY,
      cycleStarts: DEFAULT_CYCLE_STARTS,
      calendarService: null,
      reminderService: null,

      setProfile: (p) => set((s) => ({ ...s, ...p })),
      setAvailableHoursPerDay: (hours) =>
        set({ availableHoursPerDay: Math.max(1, Math.min(24, hours)) }),
      setCycleStart: (index, start) =>
        set((s) => ({
          cycleStarts: s.cycleStarts.map((c, i) => (i === index ? start : c)),
        })),
      setCalendarService: (calendarService) => set({ calendarService }),
      setReminderService: (reminderService) => set({ reminderService }),
    }),
    {
      name: 'pure-alembic-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
