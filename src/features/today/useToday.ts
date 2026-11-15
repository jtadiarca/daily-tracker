import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Task } from '../../db/types'
import { occursOn } from '../../lib/recurrence'
import { deriveStatus, type Status } from '../../lib/status'
export interface DayItem { task: Task; done: boolean; status: Status }
export function useDayTasks(date: string, now: Date): DayItem[] | undefined {
  const rows = useLiveQuery(async () => {
    const tasks = await db.tasks.where('startDate').belowOrEqual(date).filter(task => !task.deletedAt && occursOn(task, date)).toArray()
    const completions = await db.completions.where('date').equals(date).toArray()
    const done = new Set(completions.filter(c => !c.deletedAt).map(c => c.taskId))
    return tasks.map(task => ({ task, done: done.has(task.id) }))
  }, [date])
  return rows?.map(row => ({ ...row, status: deriveStatus({ date, time: row.task.time, done: row.done, now }) }))
}
