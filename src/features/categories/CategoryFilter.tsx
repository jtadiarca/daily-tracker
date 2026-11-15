import type { Category } from '../../db/types'
import { FILTER_ALL, FILTER_NONE, effectiveFilter } from '../../lib/categories'
import type { CategoryView } from './useCategoryView'

// Chips to show one category at a time, plus a switch between grouping by time and by category.
// Nothing is drawn until the person has created at least one category.
// Pass showGroupBy={false} where grouping by time makes no sense (the Dashboard).
export function CategoryFilter({ categories, view, showGroupBy = true }: {
  categories: Category[]
  view: Pick<CategoryView, 'filter' | 'setFilter'> & Partial<Pick<CategoryView, 'groupBy' | 'setGroupBy'>>
  showGroupBy?: boolean
}) {
  if (categories.length === 0) return null
  const current = effectiveFilter(view.filter, categories)
  const chip = (value: string, label: string) => (
    <button key={value} type="button" aria-pressed={current === value} onClick={() => view.setFilter(value)} className={`chip ${current === value ? 'chip-selected' : ''}`}>{label}</button>
  )
  return (
    <div className="mb-4 space-y-3">
      <div role="group" aria-label="Show category" className="flex flex-wrap gap-2">
        {chip(FILTER_ALL, 'All')}
        {categories.map(c => chip(c.id, c.name))}
        {chip(FILTER_NONE, 'No category')}
      </div>
      {showGroupBy && view.setGroupBy && current === FILTER_ALL && (
        <div role="group" aria-label="Group tasks by" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-on-surface-variant">Group by</span>
          {(['category', 'time'] as const).map(g => (
            <button key={g} type="button" aria-pressed={view.groupBy === g} onClick={() => view.setGroupBy!(g)} className={`chip ${view.groupBy === g ? 'chip-selected' : ''}`}>{g === 'category' ? 'Category' : 'Time'}</button>
          ))}
        </div>
      )}
    </div>
  )
}
