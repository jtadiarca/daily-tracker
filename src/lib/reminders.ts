import type { Task } from '../db/types'
import { addDaysStr, parseDateStr, todayStr } from './dates'
import { occursOn } from './recurrence'
import { isSlotDone, slotsOf } from './slots'

export interface Reminder {
  id: string          // unique per occurrence + fire time
  taskId: string
  date: string        // local YYYY-MM-DD of the occurrence
  title: string
  time: string        // local HH:mm the task is due
  fireAt: Date
  dueAt: Date
}

// Late-fire window: a reminder missed by timer drift or sleep still fires if the task is at most this late.
export const GRACE_MS = 5 * 60 * 1000

// task.reminderOffsetMin: null/undefined = use the default setting, -1 = none, 0 = at time, N = N minutes before.
// Returns minutes before due, or null for "no reminder".
export function effectiveOffset(task: Pick<Task, 'reminderOffsetMin'>, defaultOffset: number | null | undefined): number | null {
  const v = task.reminderOffsetMin ?? defaultOffset
  return v == null || v < 0 ? null : v
}

export function atLocal(date: string, time: string): Date {
  const d = parseDateStr(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export interface PlanInput {
  tasks: Task[]
  doneKeys: Set<string>       // completion ids that are done
  firedIds: Set<string>
  now: Date
  defaultOffset: number | null | undefined
}

// Looks at today and tomorrow (so a 00:30 task with a 60 min offset fires the evening before).
// A task with several times a day gets one reminder per time.
export function planReminders(p: PlanInput): { fireNow: Reminder[]; scheduled: Reminder[] } {
  const today = todayStr(p.now)
  const dates = [today, addDaysStr(today, 1)]
  const fireNow: Reminder[] = []
  const scheduled: Reminder[] = []
  const nowMs = p.now.getTime()

  for (const t of p.tasks) {
    if (t.deletedAt) continue
    const off = effectiveOffset(t, p.defaultOffset)
    if (off == null) continue
    for (const date of dates) {
      if (!occursOn(t, date)) continue
      for (const slot of slotsOf(t, date)) {
        if (!slot) continue
        if (isSlotDone(p.doneKeys, t, date, slot)) continue
        const dueAt = atLocal(date, slot)
        const fireAt = new Date(dueAt.getTime() - off * 60000)
        const id = `${t.id}_${date}_${fireAt.getTime()}`
        if (p.firedIds.has(id)) continue
        if (nowMs > dueAt.getTime() + GRACE_MS) continue
        const r: Reminder = { id, taskId: t.id, date, title: t.title, time: slot, fireAt, dueAt }
        if (fireAt.getTime() <= nowMs) fireNow.push(r)
        else scheduled.push(r)
      }
    }
  }
  scheduled.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
  return { fireNow, scheduled }
}
