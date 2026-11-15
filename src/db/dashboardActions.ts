import { format } from 'date-fns'
import { db } from './db'
import type { Task } from './types'
import { setDone } from './repo'
import { newId, nowIso, todayStr } from '../lib/dates'

export const markDoneLate = (taskId: string, date: string) => setDone(taskId, date, true)

// Creates a one-off copy for today and flags the missed date as rescheduled. The original date stays
// missed in the chart and streaks (history is not rewritten); it only leaves the actionable missed list.
// The copy keeps the time only if it is still ahead today, otherwise it goes under Anytime.
export async function rescheduleToToday(taskId: string, date: string, now = new Date()) {
  const today = todayStr(now)
  await db.transaction('rw', db.tasks, async () => {
    const orig = await db.tasks.get(taskId)
    if (!orig || orig.deletedAt) return
    const stamp = nowIso()
    const keepTime = orig.time && orig.time >= format(now, 'HH:mm') ? orig.time : undefined
    const copy: Task = {
      id: newId(), title: orig.title, notes: orig.notes, startDate: today, time: keepTime,
      recurrence: { type: 'none' }, reminderOffsetMin: keepTime ? (orig.reminderOffsetMin ?? null) : null,
      createdAt: stamp, updatedAt: stamp,
    }
    const rescheduledDates = [...new Set([...(orig.recurrence.rescheduledDates ?? []), date])].sort()
    await db.tasks.add(copy)
    await db.tasks.put({ ...orig, recurrence: { ...orig.recurrence, rescheduledDates }, updatedAt: stamp })
  })
}
