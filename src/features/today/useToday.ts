import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Task } from '../../db/types'

export function useDayTasks(date: string) {
  return useLiveQuery(async () => {
    const tasks: Task[] = (await db.tasks.where('startDate').equals(date).toArray())
      .filter(t => !t.deletedAt)
    const comps = (await db.completions.where('date').equals(date).toArray())
      .filter(c => !c.deletedAt)
    const done = new Set(comps.map(c => c.taskId))
    return tasks
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.createdAt.localeCompare(b.createdAt))
      .map(t => ({ task: t, done: done.has(t.id) }))
  }, [date])
}
