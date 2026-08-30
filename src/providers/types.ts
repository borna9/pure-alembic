// Provider abstraction — IF-1: the architecture allows additional
// calendar/reminder providers to be added.

export interface CalendarEventSpec {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  hours: number; // duration; end = start + hours (FR-26)
  notes: string;
}

export interface ReminderSpec {
  title: string;
  notes: string;
}

export interface CreatedItem {
  /** Human-facing URL of the created item (FR-28). */
  url: string | null;
  /** Provider-side id, kept for two-way sync where supported. */
  id: string | null;
}

export interface CalendarProvider {
  /** Create an event and return its URL and id (IF-2, FR-28). */
  createEvent(spec: CalendarEventSpec): Promise<CreatedItem>;
}

export interface ReminderProvider {
  /** Create a reminder task and return its URL and id (IF-2, FR-28). */
  createReminder(spec: ReminderSpec): Promise<CreatedItem>;
}
