export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'monthlyWeekday' | 'yearly'
export interface Recurrence {
  type: RecurrenceType
  interval?: number             // every N days, weeks, months or years (default 1), counted from the start date
  daysOfWeek?: number[]         // weekly: the days to repeat on (0 = Sunday); monthlyWeekday: the one weekday
  daysOfMonth?: number[]        // monthly: one or two days, 1 to 31, or -1 for the last day (default: the start date's day)
  weekOfMonth?: number          // monthlyWeekday: 1 to 4, or -1 for the last (default: the start date's)
  endDate?: string; skipDates?: string[]; rescheduledDates?: string[]
}
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
