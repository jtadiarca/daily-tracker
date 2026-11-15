import { z } from 'zod'
import { CURRENT_SCHEMA_VERSION } from './migrations'

export const APP_ID = 'daily-task-tracker'

const dateStr = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-11-15')
  .refine(s => {
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }, 'is not a real calendar date')
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time like 09:30')
// A date, optionally followed by @HH:mm for tasks that appear several times a day.
const slotDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}(@([01]\d|2[0-3]):[0-5]\d)?$/, 'must be a date like 2026-11-15, optionally followed by @09:30')
const isoUtc = z.string().datetime({ message: 'must be an ISO 8601 UTC timestamp' })
const dayOfMonth = z.number().int().refine(n => n === -1 || (n >= 1 && n <= 31), 'must be 1 to 31, or -1 for the last day')
const weekOfMonth = z.number().int().refine(n => [1, 2, 3, 4, -1].includes(n), 'must be 1, 2, 3, 4 or -1 for the last')

export const RecurrenceSchema = z.object({
  type: z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly', 'monthlyWeekday', 'yearly']),
  interval: z.number().int().min(1).max(999).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  daysOfMonth: z.array(dayOfMonth).min(1).max(2).optional(),
  weekOfMonth: weekOfMonth.optional(),
  endDate: dateStr.optional(),
  skipDates: z.array(dateStr).optional(),
  rescheduledDates: z.array(slotDateStr).optional(),
})

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  startDate: dateStr,
  time: timeStr.optional(),
  times: z.array(timeStr).min(2).max(24).optional(),
  timesFrom: dateStr.optional(),
  recurrence: RecurrenceSchema,
  reminderOffsetMin: z.number().int().min(-1).max(1440).nullable().optional(),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  deletedAt: isoUtc.optional(),
})

export const CompletionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  date: dateStr,
  slot: timeStr.optional(),
  completedAt: isoUtc,
  updatedAt: isoUtc,
  deletedAt: isoUtc.optional(),
}).refine(c => c.id === (c.slot ? `${c.taskId}_${c.date}_${c.slot}` : `${c.taskId}_${c.date}`), {
  message: 'id must equal taskId_date (plus _HH:mm for a time slot)',
})

export const SettingsSchema = z.object({
  id: z.literal('settings'),
  timeFormat: z.enum(['12h', '24h']),
  defaultReminderOffsetMin: z.number().int().min(-1).max(1440).nullable(),
  updatedAt: isoUtc,
})

// Notification permission is device-specific and is never part of a backup.
export const EnvelopeSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  exportedAt: isoUtc,
  deviceId: z.string().min(1),
  data: z.object({
    tasks: z.array(TaskSchema),
    completions: z.array(CompletionSchema),
    settings: z.union([SettingsSchema, z.object({}).strict()]).optional(),
  }),
})

export type Envelope = z.infer<typeof EnvelopeSchema>
