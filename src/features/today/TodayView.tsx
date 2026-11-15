import { useState } from 'react'
import { useDayTasks, type DayItem } from './useToday'
import { createTask, deleteTask, setDone } from '../../db/repo'
import type { Task } from '../../db/types'
import { formatTime } from '../../lib/time'
import { completionSlot } from '../../lib/slots'
import { DeleteDialog } from '../../components/DeleteDialog'
export function TodayView({ date, now, onEdit }: { date: string; now: Date; onEdit: (task: Task) => void }) {
  const items = useDayTasks(date, now)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [error, setError] = useState('')
  const run = async (work: () => Promise<unknown>) => { try { await work(); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not save change') } }
  const renderRows = (rows: DayItem[]) => <ul className="space-y-2">{rows.map(({ task, slot, index, count, done, status }) => {
    const multi = count > 1
    const label = multi && slot ? `${task.title} at ${formatTime(slot)}` : task.title
    return <li key={`${task.id}_${slot ?? ''}`} className="flex flex-wrap items-center gap-3 rounded-m3-md bg-surface-container-low p-3 shadow-m3-1">
      <input type="checkbox" checked={done} aria-label={`Mark ${label} ${done ? 'not done' : 'done'}`} className="h-6 w-6 shrink-0" onChange={e => { const checked = e.target.checked; void run(() => setDone(task.id, date, checked, completionSlot(task, date, slot))) }} />
      <button className="min-w-0 flex-1 break-words text-left" onClick={() => onEdit(task)}><span className={done ? 'text-on-surface-variant line-through' : 'text-on-surface'}>{task.title}</span>{multi && <span className="ml-2 text-xs text-on-surface-variant">({index + 1} of {count})</span>}{task.recurrence.type !== 'none' && <span className="ml-2 text-xs text-on-surface-variant">(repeats)</span>}{task.notes && <span className="block text-sm text-on-surface-variant">{task.notes}</span>}</button>
      {slot && <span className="text-sm tabular-nums text-on-surface-variant">{formatTime(slot)}</span>}
      {status === 'missed' && <span className="badge-error"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>Missed</span>}
      {done && <span className="sr-only">Done</span>}
      <button className="btn-text-error" aria-label={`Delete ${task.title}`} onClick={() => task.recurrence.type === 'none' ? void run(() => deleteTask(task.id)) : setDeleting(task)}>Delete</button>
    </li>
  })}</ul>
  const timed = (items ?? []).filter(i => i.slot).sort((a, b) => a.slot!.localeCompare(b.slot!) || a.task.createdAt.localeCompare(b.task.createdAt))
  const anytime = (items ?? []).filter(i => !i.slot).sort((a, b) => a.task.createdAt.localeCompare(b.task.createdAt))
  return <section className="mx-auto max-w-xl p-4 pb-32" aria-labelledby="today-heading">
    <h1 id="today-heading" className="mb-4 text-3xl">Today</h1>
    <form className="mb-4" onSubmit={e => { e.preventDefault(); if (title.trim()) void run(async () => { await createTask({ title, startDate: date }); setTitle('') }) }}>
      <label htmlFor="quick" className="sr-only">Quick add task</label><input id="quick" value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task and press Enter" className="w-full rounded-full bg-surface-container-high px-5 py-3 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary" />
    </form>
    {error && <p role="alert" className="mb-2 text-error">{error}</p>}
    {!items && <p className="text-on-surface-variant">Loading tasks…</p>}{items?.length === 0 && <p className="text-on-surface-variant">Nothing yet. Add your first task.</p>}
    {timed.length > 0 && <><h2 className="section-title mb-2">Scheduled</h2>{renderRows(timed)}</>}
    {anytime.length > 0 && <><h2 className="section-title mb-2 mt-6">Anytime</h2>{renderRows(anytime)}</>}
    <DeleteDialog task={deleting} date={date} onClose={() => setDeleting(null)} />
  </section>
}
