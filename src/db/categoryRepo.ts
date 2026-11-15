import { db } from './db'
import type { Category } from './types'
import { newId, nowIso } from '../lib/dates'
import { normalizeCategoryName, validateCategoryName } from '../lib/categories'

// The only code that writes categories. Like tasks, a deleted category stays as a tombstone so the
// deletion travels in backups. Tasks that point at it simply show as "No category".

export async function createCategory(name: string): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const problem = validateCategoryName(name, await db.categories.toArray())
    if (problem) throw new Error(problem)
    const now = nowIso()
    const category: Category = { id: newId(), name: normalizeCategoryName(name), createdAt: now, updatedAt: now }
    await db.categories.add(category)
    return category
  })
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const problem = validateCategoryName(name, await db.categories.toArray(), id)
    if (problem) throw new Error(problem)
    const current = await db.categories.get(id)
    if (!current || current.deletedAt) throw new Error('That category no longer exists.')
    await db.categories.put({ ...current, name: normalizeCategoryName(name), updatedAt: nowIso() })
  })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const current = await db.categories.get(id)
    if (!current || current.deletedAt) return
    const now = nowIso()
    await db.categories.put({ ...current, deletedAt: now, updatedAt: now })
  })
}
