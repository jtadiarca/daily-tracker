import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createTask, updateTask } from './repo'
import { createCategory, deleteCategory, renameCategory } from './categoryRepo'
import { liveCategories } from '../lib/categories'

beforeEach(async () => {
  await Promise.all([db.tasks.clear(), db.categories.clear()])
})

describe('categoryRepo', () => {
  it('creates a category with a cleaned name and a UUID', async () => {
    const c = await createCategory('  Home   chores ')
    expect(c.name).toBe('Home chores')
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(c.updatedAt).toBe(c.createdAt)
    expect(await db.categories.get(c.id)).toEqual(c)
  })
  it('rejects empty, too long and duplicate names', async () => {
    await createCategory('Work')
    await expect(createCategory('  ')).rejects.toThrow(/Enter a category name/)
    await expect(createCategory('x'.repeat(41))).rejects.toThrow(/up to 40/)
    await expect(createCategory('work')).rejects.toThrow(/already exists/)
    expect(await db.categories.count()).toBe(1)
  })
  it('renames, stamps updatedAt and rejects a clash', async () => {
    const a = await createCategory('Work')
    await createCategory('Home')
    await expect(renameCategory(a.id, 'home')).rejects.toThrow(/already exists/)
    await new Promise(r => setTimeout(r, 5))
    await renameCategory(a.id, 'Office')
    const after = await db.categories.get(a.id)
    expect(after?.name).toBe('Office')
    expect(after!.updatedAt > a.updatedAt).toBe(true)
    expect(after?.createdAt).toBe(a.createdAt)
  })
  it('renaming a deleted or unknown category fails', async () => {
    const a = await createCategory('Work')
    await deleteCategory(a.id)
    await expect(renameCategory(a.id, 'Office')).rejects.toThrow(/no longer exists/)
    await expect(renameCategory('missing', 'Office')).rejects.toThrow(/no longer exists/)
  })
  it('delete leaves a tombstone, and its name can be reused', async () => {
    const a = await createCategory('Work')
    await deleteCategory(a.id)
    const row = await db.categories.get(a.id)
    expect(row?.deletedAt).toBeDefined()
    expect(liveCategories(await db.categories.toArray())).toHaveLength(0)
    await expect(createCategory('Work')).resolves.toMatchObject({ name: 'Work' })
    await deleteCategory(a.id)
    await deleteCategory('missing')
  })
  it('tasks keep their category on create and update, and update can clear it', async () => {
    const c = await createCategory('Work')
    const t = await createTask({ title: 'Report', startDate: '2026-11-15', categoryId: c.id })
    expect((await db.tasks.get(t.id))?.categoryId).toBe(c.id)
    await updateTask(t.id, { title: 'Report v2' })
    expect((await db.tasks.get(t.id))?.categoryId).toBe(c.id)
    await updateTask(t.id, { categoryId: undefined })
    expect((await db.tasks.get(t.id))?.categoryId).toBeUndefined()
  })
  it('deleting a category does not touch its tasks', async () => {
    const c = await createCategory('Work')
    const t = await createTask({ title: 'Report', startDate: '2026-11-15', categoryId: c.id })
    const before = await db.tasks.get(t.id)
    await deleteCategory(c.id)
    expect(await db.tasks.get(t.id)).toEqual(before)
  })
})
