export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly'
export interface Recurrence { type: RecurrenceType; daysOfWeek?: number[]; endDate?: string; skipDates?: string[] }
export interface Task { id: string; title: string; notes?: string; startDate: string; time?: string; recurrence: Recurrence; reminderOffsetMin?: number | null; createdAt: string; updatedAt: string; deletedAt?: string }
export interface Completion { id: string; taskId: string; date: string; completedAt: string; updatedAt: string; deletedAt?: string }
export interface Settings { id: 'settings'; timeFormat: '12h' | '24h'; defaultReminderOffsetMin: number | null; updatedAt: string }
