import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Task } from '../../db/types'
import { occursOn } from '../../lib/recurrence'
import { isSlotDone, slotsOf, type Slot } from '../../lib/slots'
import { deriveStatus, type Status } from '../../lib/status'

// One row per time a task has to be done today (a task with three times gives three items).
export interface DayItem { task: Task; slot: Slot; index: number; count: number; done: boolean; status: Status }

export function useDayTasks(date: string, now: Date): DayItem[] | undefined {
  const rows = useLiveQuery(async () => {
    const tasks = await db.tasks.where('startDate').belowOrEqual(date).filter(task => !task.deletedAt && occursOn(task, date)).toArray()
    const completions = await db.completions.where('date').equals(date).toArray()
    return { tasks, done: completions.filter(c => !c.deletedAt).map(c => c.id) }
  }, [date])
  if (!rows) return undefined
  const done = new Set(rows.done)
  return rows.tasks.flatMap(task => {
    const slots = slotsOf(task, date)
    return slots.map((slot, index) => {
      const isDone = isSlotDone(done, task, date, slot)
      return { task, slot, index, count: slots.length, done: isDone, status: deriveStatus({ date, time: slot ?? undefined, done: isDone, now }) }
    })
  })
}
