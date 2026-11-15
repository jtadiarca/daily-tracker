import { useMemo } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category, Task } from '../../db/types'
import { categoryOf, effectiveFilter, groupByCategory, matchesFilter } from '../../lib/categories'
import { CategoryFilter } from '../categories/CategoryFilter'
import { groupsByCategory, type CategoryView } from '../categories/useCategoryView'
import { addDaysStr, parseDateStr } from '../../lib/dates'
import { occursOn } from '../../lib/recurrence'
import { isSlotDone, slotsOf } from '../../lib/slots'
import { formatTime } from '../../lib/time'

const DAYS_AHEAD = 14

export function UpcomingView({ date, categories, view, onEdit }: { date: string; categories: Category[]; view: CategoryView; onEdit: (t: Task) => void }) {
  const filter = effectiveFilter(view.filter, categories)
  const byCategory = groupsByCategory(view, filter, categories.length)
  const end = addDaysStr(date, DAYS_AHEAD - 1)
  const data = useLiveQuery(async () => {
    const tasks = await db.tasks.where('startDate').belowOrEqual(end).filter(t => !t.deletedAt).toArray()
    const comps = (await db.completions.where('date').between(date, end, true, true).toArray()).filter(c => !c.deletedAt)
    return { tasks, done: comps.map(c => c.id) }
  }, [date, end])

  const groups = useMemo(() => {
    if (!data) return []
    const done = new Set(data.done)
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysStr(date, i)).map(d => ({
      date: d,
      items: data.tasks.filter(t => matchesFilter(t, filter, categories) && occursOn(t, d))
        .flatMap(task => {
          const slots = slotsOf(task, d)
          return slots.map((slot, index) => ({ task, slot, index, count: slots.length, done: isSlotDone(done, task, d, slot) }))
        })
        .sort((a, b) => (a.slot ?? '99:99').localeCompare(b.slot ?? '99:99') || a.task.createdAt.localeCompare(b.task.createdAt)),
    })).filter(g => g.items.length > 0)
  }, [data, date, filter, categories])

  const renderList = (rows: Array<{ task: Task; slot: string | null; index: number; count: number; done: boolean }>, showCategory: boolean) => (
    <ul className="space-y-2">
      {rows.map(({ task, slot, index, count, done }) => {
        const category = showCategory ? categoryOf(task, categories) : null
        return (
          <li key={`${task.id}_${slot ?? ''}`}>
            <button className="flex min-h-[56px] w-full items-center gap-3 rounded-m3-md bg-surface-container-low p-3 text-left shadow-m3-1 hover:bg-surface-container" onClick={() => onEdit(task)}>
              <span className="w-20 shrink-0 text-sm tabular-nums text-on-surface-variant">{slot ? formatTime(slot) : 'Anytime'}</span>
              <span className={`min-w-0 flex-1 break-words ${done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{task.title}</span>
              {category && <span className="rounded-m3-sm bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">{category.name}</span>}
              {count > 1 && <span className="text-xs text-on-surface-variant">({index + 1} of {count})</span>}
              {done && <span className="text-sm text-on-surface-variant">Done</span>}
              {task.recurrence.type !== 'none' && <span className="text-xs text-on-surface-variant">(repeats)</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const label = (d: string) => (d === date ? 'Today' : d === addDaysStr(date, 1) ? 'Tomorrow' : format(parseDateStr(d), 'EEEE, MMM d'))

  return (
    <section aria-labelledby="up-h" className="page space-y-5">
      <h1 id="up-h" className="text-3xl">Upcoming</h1>
      <p className="text-sm text-on-surface-variant">The next {DAYS_AHEAD} days. Tap a task to edit it.</p>
      <CategoryFilter categories={categories} view={view} />
      {data && groups.length === 0 && <p className="text-on-surface-variant">{filter === 'all' ? `Nothing scheduled in the next ${DAYS_AHEAD} days.` : `Nothing in this category in the next ${DAYS_AHEAD} days.`}</p>}
      {/* Days run down one column on phones and fill two columns on wide screens. */}
      <div className="cols-2">{groups.map(g => (
        <section key={g.date} aria-labelledby={`up-${g.date}`}>
          <h2 id={`up-${g.date}`} className="section-title mb-2">{label(g.date)}</h2>
          {byCategory
            ? groupByCategory(g.items, categories).map(cg => (
              <div key={cg.key} className="mt-3 first:mt-0">
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-on-surface-variant">{cg.category?.name ?? 'No category'}</h3>
                {renderList(cg.items, false)}
              </div>))
            : renderList(g.items, true)}
        </section>
      ))}</div>
    </section>
  )
}
