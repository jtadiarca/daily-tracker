import { useCallback, useState } from 'react'
import { FILTER_ALL, type CategoryFilter } from '../../lib/categories'

export type GroupBy = 'time' | 'category'
export interface CategoryView {
  filter: CategoryFilter
  setFilter: (f: CategoryFilter) => void
  groupBy: GroupBy
  setGroupBy: (g: GroupBy) => void
}

// How the Today and Upcoming tabs show categories is a per-device viewing preference, so it is kept
// in localStorage and never goes into a backup.
const FILTER_KEY = 'dtt.categoryFilter'
const GROUP_KEY = 'dtt.groupBy'

const read = (key: string): string | null => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* storage may be unavailable */ } }

export function useCategoryView(): CategoryView {
  const [filter, setFilterState] = useState<CategoryFilter>(() => read(FILTER_KEY) || FILTER_ALL)
  const [groupBy, setGroupByState] = useState<GroupBy>(() => (read(GROUP_KEY) === 'time' ? 'time' : 'category'))
  const setFilter = useCallback((f: CategoryFilter) => { setFilterState(f); write(FILTER_KEY, f) }, [])
  const setGroupBy = useCallback((g: GroupBy) => { setGroupByState(g); write(GROUP_KEY, g) }, [])
  return { filter, setFilter, groupBy, setGroupBy }
}

// The Dashboard keeps its own category filter, so narrowing Today does not narrow the stats.
const DASH_FILTER_KEY = 'dtt.dashboardCategoryFilter'
export function useDashboardCategoryFilter(): Pick<CategoryView, 'filter' | 'setFilter'> {
  const [filter, setFilterState] = useState<CategoryFilter>(() => read(DASH_FILTER_KEY) || FILTER_ALL)
  const setFilter = useCallback((f: CategoryFilter) => { setFilterState(f); write(DASH_FILTER_KEY, f) }, [])
  return { filter, setFilter }
}

// Tasks are grouped under category headings only when categories exist, the view is on "Group by
// category", and no single category is selected (a single category is just one group).
export const groupsByCategory = (view: Pick<CategoryView, 'groupBy'>, effective: CategoryFilter, categoryCount: number): boolean =>
  categoryCount > 0 && view.groupBy === 'category' && effective === FILTER_ALL
