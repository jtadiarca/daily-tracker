import type { Category, Task } from '../db/types'

export const MAX_CATEGORY_NAME = 40

// What the Today and Upcoming filter can be set to: 'all', 'none' (tasks with no category), or a category id.
export type CategoryFilter = string
export const FILTER_ALL = 'all'
export const FILTER_NONE = 'none'

type HasCategory = Pick<Task, 'categoryId'>

// Trims the ends and collapses runs of spaces, so "  Home   chores " becomes "Home chores".
export const normalizeCategoryName = (name: string): string => name.replace(/\s+/g, ' ').trim()

const sameName = (a: string, b: string) => normalizeCategoryName(a).toLocaleLowerCase() === normalizeCategoryName(b).toLocaleLowerCase()

// The categories that have not been deleted, in a fixed order: oldest first, then by name.
export function liveCategories(all: Category[]): Category[] {
  return all
    .filter(c => !c.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export const findCategoryByName = (all: Category[], name: string): Category | undefined =>
  liveCategories(all).find(c => sameName(c.name, name))

// Returns a message for the first problem, or null when the name can be used.
// `ignoreId` lets a category keep its own name when it is renamed.
export function validateCategoryName(name: string, all: Category[], ignoreId?: string): string | null {
  const clean = normalizeCategoryName(name)
  if (!clean) return 'Enter a category name.'
  if (clean.length > MAX_CATEGORY_NAME) return `Category names can be up to ${MAX_CATEGORY_NAME} characters.`
  const clash = liveCategories(all).find(c => c.id !== ignoreId && sameName(c.name, clean))
  return clash ? `A category named “${clash.name}” already exists.` : null
}

// The task's category, or null when it has none or its category was deleted.
export const categoryOf = (task: HasCategory, live: Category[]): Category | null =>
  (task.categoryId ? live.find(c => c.id === task.categoryId) : undefined) ?? null

// A saved filter can point at a category that was deleted since. That counts as "All".
export const effectiveFilter = (filter: CategoryFilter, live: Category[]): CategoryFilter =>
  filter === FILTER_ALL || filter === FILTER_NONE || live.some(c => c.id === filter) ? filter : FILTER_ALL

export function matchesFilter(task: HasCategory, filter: CategoryFilter, live: Category[]): boolean {
  const f = effectiveFilter(filter, live)
  if (f === FILTER_ALL) return true
  const cat = categoryOf(task, live)
  return f === FILTER_NONE ? cat === null : cat?.id === f
}

// The category id a new task should start in for a filter value (none for All and No category).
export const categoryForFilter = (filter: CategoryFilter, live: Category[]): string | undefined => {
  const f = effectiveFilter(filter, live)
  return f === FILTER_ALL || f === FILTER_NONE ? undefined : f
}

export interface CategoryGroup<T> { key: string; category: Category | null; items: T[] }

// Splits items into one group per category (in category order) and a final "No category" group.
// Empty groups are left out, and the order of items inside a group is kept.
export function groupByCategory<T extends { task: HasCategory }>(items: T[], live: Category[]): CategoryGroup<T>[] {
  const groups: CategoryGroup<T>[] = live.map(category => ({ key: category.id, category, items: [] as T[] }))
  const none: CategoryGroup<T> = { key: FILTER_NONE, category: null, items: [] }
  const byId = new Map(groups.map(g => [g.key, g]))
  for (const item of items) {
    const cat = categoryOf(item.task, live)
    ;(cat ? byId.get(cat.id)! : none).items.push(item)
  }
  return [...groups, none].filter(g => g.items.length > 0)
}

// How many live tasks use each category (a category that was deleted counts for nothing).
export function countByCategory(tasks: Array<HasCategory & { deletedAt?: string }>, live: Category[]): Map<string, number> {
  const counts = new Map(live.map(c => [c.id, 0]))
  for (const t of tasks) {
    if (t.deletedAt) continue
    const cat = categoryOf(t, live)
    if (cat) counts.set(cat.id, (counts.get(cat.id) ?? 0) + 1)
  }
  return counts
}
