import { db } from './db'
import type { Task } from './types'
import { newId, nowIso, completionId } from '../lib/dates'

export type NewTask = Pick<Task, 'title' | 'startDate'> &
  Partial<Pick<Task, 'notes' | 'time' | 'recurrence' | 'reminderOffsetMin'>>

export async function createTask(input: NewTask): Promise<Task> {
  const now = nowIso()
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    startDate: input.startDate,
    time: input.time || undefined,
    recurrence: input.recurrence ?? { type: 'none' },
    reminderOffsetMin: input.reminderOffsetMin ?? null,
    createdAt: now, updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: string, patch: Partial<NewTask>) {
  await db.tasks.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteTask(id: string) {
  const now = nowIso()
  await db.tasks.update(id, { deletedAt: now, updatedAt: now })
}

export async function setDone(taskId: string, date: string, done: boolean) {
  const id = completionId(taskId, date)
  const now = nowIso()
  await db.transaction('rw', db.completions, async () => {
    const existing = await db.completions.get(id)
    if (done) {
      await db.completions.put({ id, taskId, date, completedAt: now, updatedAt: now })
    } else if (existing && !existing.deletedAt) {
      await db.completions.update(id, { deletedAt: now, updatedAt: now })
    }
  })
}
