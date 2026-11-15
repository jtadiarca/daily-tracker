export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly'
export interface Recurrence { type: RecurrenceType; daysOfWeek?: number[]; endDate?: string; skipDates?: string[]; rescheduledDates?: string[] }
export interface Task {
  id: string; title: string; notes?: string; startDate: string
  time?: string                 // single time of day (HH:mm); also the older single time when times is set
  times?: string[]              // two or more times of day: the task appears once per time, each checked off separately
  timesFrom?: string            // first date the times list applies to; earlier dates use the single time
  recurrence: Recurrence; reminderOffsetMin?: number | null
  createdAt: string; updatedAt: string; deletedAt?: string
}
export interface Completion {
  id: string; taskId: string; date: string
  slot?: string                 // HH:mm, only for tasks that appear several times a day
  completedAt: string; updatedAt: string; deletedAt?: string
}
export interface Settings { id: 'settings'; timeFormat: '12h' | '24h'; defaultReminderOffsetMin: number | null; updatedAt: string }
