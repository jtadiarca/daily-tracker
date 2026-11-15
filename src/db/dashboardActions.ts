import { format } from 'date-fns'
import { db } from './db'
import type { Task } from './types'
import { setDone } from './repo'
import { newId, nowIso, todayStr } from '../lib/dates'
import { completionSlot, rescheduleKey, type Slot } from '../lib/slots'

export const markDoneLate = (task: Task, date: string, slot: Slot) =>
  setDone(task.id, date, true, completionSlot(task, date, slot))

// Creates a one-off copy for today and flags the missed occurrence as rescheduled. The original stays
// missed in the chart and streaks (history is not rewritten); it only leaves the actionable missed list.
// The copy keeps the time only if it is still ahead today, otherwise it goes under Anytime.
export async function rescheduleToToday(taskId: string, date: string, slot: Slot, now = new Date()) {
  const today = todayStr(now)
  await db.transaction('rw', db.tasks, async () => {
    const orig = await db.tasks.get(taskId)
    if (!orig || orig.deletedAt) return
    const stamp = nowIso()
    const due = slot ?? orig.time
    const keepTime = due && due >= format(now, 'HH:mm') ? due : undefined
    const copy: Task = {
      id: newId(), title: orig.title, notes: orig.notes, startDate: today, time: keepTime,
      recurrence: { type: 'none' }, reminderOffsetMin: keepTime ? (orig.reminderOffsetMin ?? null) : null,
      createdAt: stamp, updatedAt: stamp,
    }
    const rescheduledDates = [...new Set([...(orig.recurrence.rescheduledDates ?? []), rescheduleKey(orig, date, slot)])].sort()
    await db.tasks.add(copy)
    await db.tasks.put({ ...orig, recurrence: { ...orig.recurrence, rescheduledDates }, updatedAt: stamp })
  })
}
