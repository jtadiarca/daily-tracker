import Dexie, { type Table } from 'dexie'
import type { Task, Completion, Settings, Category } from './types'

class AppDB extends Dexie {
  tasks!: Table<Task, string>
  completions!: Table<Completion, string>
  settings!: Table<Settings, string>
  categories!: Table<Category, string>
  meta!: Table<{ key: string; value: unknown }, string>
  constructor() {
    super('daily-task-tracker')
    this.version(1).stores({
      tasks: 'id, startDate, updatedAt, deletedAt',
      completions: 'id, [taskId+date], date, taskId, updatedAt, deletedAt',
      settings: 'id',
      meta: 'key',
    })
    // v2 adds user-defined categories. Tasks gain an optional categoryId, which needs no index.
    this.version(2).stores({ categories: 'id, updatedAt, deletedAt' })
  }
}
export const db = new AppDB()

export async function getDeviceId(): Promise<string> {
  const row = await db.meta.get('deviceId')
  if (row) return row.value as string
  const id = crypto.randomUUID()
  await db.meta.put({ key: 'deviceId', value: id })
  return id
}
