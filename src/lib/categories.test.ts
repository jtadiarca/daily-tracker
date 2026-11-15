import { describe, it, expect } from 'vitest'
import type { Category } from '../db/types'
import {
  categoryForFilter, categoryOf, countByCategory, effectiveFilter, findCategoryByName, groupByCategory, liveCategories,
  matchesFilter, normalizeCategoryName, validateCategoryName, MAX_CATEGORY_NAME,
} from './categories'

const cat = (id: string, name: string, created: number, o: Partial<Category> = {}): Category => ({
  id, name, createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, created)).toISOString(), updatedAt: new Date(Date.UTC(2026, 10, 1, 0, 0, created)).toISOString(), ...o,
})
const work = cat('w', 'Work', 1)
const home = cat('h', 'Home', 2)
const old = cat('x', 'Old', 3, { deletedAt: '2026-11-02T00:00:00.000Z' })
const ALL = [home, old, work]
const live = liveCategories(ALL)
const item = (id: string, categoryId?: string) => ({ task: { categoryId }, id })

describe('names', () => {
  it('normalizes spaces', () => {
    expect(normalizeCategoryName('  Home   chores ')).toBe('Home chores')
  })
  it('accepts a fresh name', () => {
    expect(validateCategoryName('Errands', ALL)).toBeNull()
  })
  it('rejects an empty name and a name that is too long', () => {
    expect(validateCategoryName('   ', ALL)).toMatch(/Enter a category name/)
    expect(validateCategoryName('x'.repeat(MAX_CATEGORY_NAME + 1), ALL)).toMatch(/up to 40/)
    expect(validateCategoryName('x'.repeat(MAX_CATEGORY_NAME), ALL)).toBeNull()
  })
  it('rejects a duplicate ignoring case and extra spaces, but allows reusing a deleted name', () => {
    expect(validateCategoryName(' work ', ALL)).toMatch(/already exists/)
    expect(validateCategoryName('HOME', ALL)).toMatch(/already exists/)
    expect(validateCategoryName('old', ALL)).toBeNull()
  })
  it('lets a category keep its own name when renamed', () => {
    expect(validateCategoryName('Work', ALL, 'w')).toBeNull()
    expect(validateCategoryName('Home', ALL, 'w')).toMatch(/already exists/)
  })
  it('finds a live category by name', () => {
    expect(findCategoryByName(ALL, ' WORK')?.id).toBe('w')
    expect(findCategoryByName(ALL, 'Old')).toBeUndefined()
  })
})

describe('liveCategories', () => {
  it('drops deleted ones and sorts oldest first', () => {
    expect(live.map(c => c.id)).toEqual(['w', 'h'])
  })
  it('breaks ties by name', () => {
    const a = cat('a', 'Beta', 5), b = cat('b', 'Alpha', 5)
    expect(liveCategories([a, b]).map(c => c.name)).toEqual(['Alpha', 'Beta'])
  })
})

describe('task categories', () => {
  it('resolves a live category and treats a deleted or unknown one as none', () => {
    expect(categoryOf({ categoryId: 'w' }, live)?.name).toBe('Work')
    expect(categoryOf({ categoryId: 'x' }, live)).toBeNull()
    expect(categoryOf({ categoryId: 'nope' }, live)).toBeNull()
    expect(categoryOf({}, live)).toBeNull()
  })
  it('counts live tasks per category', () => {
    const counts = countByCategory([{ categoryId: 'w' }, { categoryId: 'w' }, { categoryId: 'h', deletedAt: 'x' }, { categoryId: 'x' }, {}], live)
    expect(counts.get('w')).toBe(2)
    expect(counts.get('h')).toBe(0)
    expect(counts.has('x')).toBe(false)
  })
})

describe('filter', () => {
  it('falls back to All when the saved category is gone', () => {
    expect(effectiveFilter('x', live)).toBe('all')
    expect(effectiveFilter('w', live)).toBe('w')
    expect(effectiveFilter('none', live)).toBe('none')
  })
  it('matches All, No category and one category', () => {
    expect(matchesFilter({ categoryId: 'w' }, 'all', live)).toBe(true)
    expect(matchesFilter({ categoryId: 'w' }, 'w', live)).toBe(true)
    expect(matchesFilter({ categoryId: 'h' }, 'w', live)).toBe(false)
    expect(matchesFilter({}, 'none', live)).toBe(true)
    expect(matchesFilter({ categoryId: 'x' }, 'none', live)).toBe(true)
    expect(matchesFilter({ categoryId: 'w' }, 'none', live)).toBe(false)
  })
  it('a deleted category filter shows everything', () => {
    expect(matchesFilter({ categoryId: 'h' }, 'x', live)).toBe(true)
  })
  it('gives a new task the filtered category only for a real category', () => {
    expect(categoryForFilter('w', live)).toBe('w')
    expect(categoryForFilter('all', live)).toBeUndefined()
    expect(categoryForFilter('none', live)).toBeUndefined()
    expect(categoryForFilter('x', live)).toBeUndefined()
  })
})

describe('groupByCategory', () => {
  const items = [item('1', 'h'), item('2'), item('3', 'w'), item('4', 'h'), item('5', 'x')]
  it('orders groups by category and puts No category last, keeping item order', () => {
    const g = groupByCategory(items, live)
    expect(g.map(x => x.key)).toEqual(['w', 'h', 'none'])
    expect(g[0].items.map(i => i.id)).toEqual(['3'])
    expect(g[1].items.map(i => i.id)).toEqual(['1', '4'])
    expect(g[2].items.map(i => i.id)).toEqual(['2', '5'])
    expect(g[2].category).toBeNull()
  })
  it('leaves out empty groups', () => {
    expect(groupByCategory([item('1', 'h')], live).map(x => x.key)).toEqual(['h'])
    expect(groupByCategory([], live)).toEqual([])
  })
  it('puts everything in No category when there are no categories', () => {
    const g = groupByCategory(items, [])
    expect(g).toHaveLength(1)
    expect(g[0].items).toHaveLength(5)
  })
})
