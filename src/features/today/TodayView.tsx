import { useState } from 'react'
import { useDayTasks, type DayItem } from './useToday'
import { createTask, deleteTask, setDone } from '../../db/repo'
import type { Category, Task } from '../../db/types'
import { categoryForFilter, categoryOf, effectiveFilter, groupByCategory, matchesFilter } from '../../lib/categories'
import { CategoryFilter } from '../categories/CategoryFilter'
import { groupsByCategory, type CategoryView } from '../categories/useCategoryView'
import { formatTime } from '../../lib/time'
import { completionSlot } from '../../lib/slots'
import { DeleteDialog } from '../../components/DeleteDialog'
export function TodayView({ date, now, categories, view, onEdit }: { date: string; now: Date; categories: Category[]; view: CategoryView; onEdit: (task: Task) => void }) {
  const items = useDayTasks(date, now)
  const filter = effectiveFilter(view.filter, categories)
  const byCategory = groupsByCategory(view, filter, categories.length)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [error, setError] = useState('')
  const run = async (work: () => Promise<unknown>) => { try { await work(); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not save change') } }
  const renderRows = (rows: DayItem[], showCategory: boolean) => <ul className="space-y-2">{rows.map(({ task, slot, index, count, done, status }) => {
    const multi = count > 1
    const category = showCategory ? categoryOf(task, categories) : null
    const label = multi && slot ? `${task.title} at ${formatTime(slot)}` : task.title
    return <li key={`${task.id}_${slot ?? ''}`} className="flex flex-wrap items-center gap-3 rounded-m3-md bg-surface-container-low p-3 shadow-m3-1">
      <input type="checkbox" checked={done} aria-label={`Mark ${label} ${done ? 'not done' : 'done'}`} className="h-6 w-6 shrink-0" onChange={e => { const checked = e.target.checked; void run(() => setDone(task.id, date, checked, completionSlot(task, date, slot))) }} />
      <button className="min-w-0 flex-1 break-words text-left" onClick={() => onEdit(task)}><span className={done ? 'text-on-surface-variant line-through' : 'text-on-surface'}>{task.title}</span>{multi && <span className="ml-2 text-xs text-on-surface-variant">({index + 1} of {count})</span>}{category && <span className="ml-2 rounded-m3-sm bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">{category.name}</span>}{task.recurrence.type !== 'none' && <span className="ml-2 text-xs text-on-surface-variant">(repeats)</span>}{task.notes && <span className="block text-sm text-on-surface-variant">{task.notes}</span>}</button>
      {slot && <span className="text-sm tabular-nums text-on-surface-variant">{formatTime(slot)}</span>}
      {status === 'missed' && <span className="badge-error"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>Missed</span>}
      {done && <span className="sr-only">Done</span>}
      <button className="btn-text-error" aria-label={`Delete ${task.title}`} onClick={() => task.recurrence.type === 'none' ? void run(() => deleteTask(task.id)) : setDeleting(task)}>Delete</button>
    </li>
  })}</ul>
  const all = items ?? []
  const visible = all.filter(i => matchesFilter(i.task, filter, categories))
  const timed = visible.filter(i => i.slot).sort((a, b) => a.slot!.localeCompare(b.slot!) || a.task.createdAt.localeCompare(b.task.createdAt))
  const anytime = visible.filter(i => !i.slot).sort((a, b) => a.task.createdAt.localeCompare(b.task.createdAt))
  // Inside a category heading the tasks stay in time order, with tasks that have no time last.
  const groups = byCategory ? groupByCategory([...timed, ...anytime], categories) : []
  return <section className="mx-auto max-w-xl p-4 pb-32" aria-labelledby="today-heading">
    <h1 id="today-heading" className="mb-4 text-3xl">Today</h1>
    <form className="mb-4" onSubmit={e => { e.preventDefault(); if (title.trim()) void run(async () => { await createTask({ title, startDate: date, categoryId: categoryForFilter(filter, categories) }); setTitle('') }) }}>
      <label htmlFor="quick" className="sr-only">Quick add task</label><input id="quick" value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task and press Enter" className="w-full rounded-full bg-surface-container-high px-5 py-3 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary" />
    </form>
    <CategoryFilter categories={categories} view={view} />
    {error && <p role="alert" className="mb-2 text-error">{error}</p>}
    {!items && <p className="text-on-surface-variant">Loading tasks…</p>}{items?.length === 0 && <p className="text-on-surface-variant">Nothing yet. Add your first task.</p>}
    {items && items.length > 0 && visible.length === 0 && <p className="text-on-surface-variant">No tasks in this category today.</p>}
    {byCategory
      ? groups.map((g, i) => <section key={g.key} aria-labelledby={`today-cat-${g.key}`} className={i > 0 ? 'mt-6' : ''}><h2 id={`today-cat-${g.key}`} className="section-title mb-2">{g.category?.name ?? 'No category'}</h2>{renderRows(g.items, false)}</section>)
      : <>
        {timed.length > 0 && <><h2 className="section-title mb-2">Scheduled</h2>{renderRows(timed, true)}</>}
        {anytime.length > 0 && <><h2 className="section-title mb-2 mt-6">Anytime</h2>{renderRows(anytime, true)}</>}
      </>}
    <DeleteDialog task={deleting} date={date} onClose={() => setDeleting(null)} />
  </section>
}
