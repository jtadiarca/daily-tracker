import { db } from './db'
import type { Task } from './types'
import { newId, nowIso, completionId, addDaysStr } from '../lib/dates'
export type NewTask = Pick<Task, 'title' | 'startDate'> & Partial<Pick<Task, 'notes' | 'time' | 'times' | 'timesFrom' | 'recurrence' | 'reminderOffsetMin'>>
export async function createTask(input: NewTask): Promise<Task> {
  if (!input.title.trim()) throw new Error('Title is required')
  const now = nowIso()
  const hasTimes = !!input.times && input.times.length >= 2
  const task: Task = {
    ...input, id: newId(), title: input.title.trim(), notes: input.notes?.trim() || undefined, time: input.time || undefined,
    times: hasTimes ? input.times : undefined, timesFrom: hasTimes ? input.timesFrom : undefined,
    recurrence: input.recurrence ?? { type: 'none' }, reminderOffsetMin: input.reminderOffsetMin ?? null, createdAt: now, updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}
export async function updateTask(id: string, patch: Partial<NewTask>) {
  if (patch.title !== undefined && !patch.title.trim()) throw new Error('Title is required')
  await db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(id)
    if (current) await db.tasks.put({ ...current, ...patch, updatedAt: nowIso() })
  })
}
export async function deleteTask(id: string) {
  const now = nowIso()
  await db.tasks.update(id, { deletedAt: now, updatedAt: now })
}
export async function skipOccurrence(id: string, date: string) {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id)
    if (!task) return
    const skipDates = [...new Set([...(task.recurrence.skipDates ?? []), date])].sort()
    await db.tasks.put({ ...task, recurrence: { ...task.recurrence, skipDates }, updatedAt: nowIso() })
  })
}
export async function endSeriesFrom(id: string, date: string) {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id)
    if (!task) return
    const now = nowIso()
    const endDate = addDaysStr(date, -1)
    if (endDate < task.startDate) await db.tasks.put({ ...task, deletedAt: now, updatedAt: now })
    else await db.tasks.put({ ...task, recurrence: { ...task.recurrence, endDate: task.recurrence.endDate && task.recurrence.endDate < endDate ? task.recurrence.endDate : endDate }, updatedAt: now })
  })
}
// slot: the time (HH:mm) for tasks that appear several times a day, otherwise null.
export async function setDone(taskId: string, date: string, done: boolean, slot: string | null = null) {
  const id = completionId(taskId, date, slot ?? undefined)
  const now = nowIso()
  await db.transaction('rw', db.completions, async () => {
    const current = await db.completions.get(id)
    if (done) await db.completions.put({ id, taskId, date, ...(slot ? { slot } : {}), completedAt: now, updatedAt: now })
    else if (current && !current.deletedAt) await db.completions.update(id, { deletedAt: now, updatedAt: now })
  })
}
