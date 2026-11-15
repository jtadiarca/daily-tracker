import { useState } from 'react'
import { useDayTasks, type DayItem } from './useToday'
import { createTask, deleteTask, setDone } from '../../db/repo'
import type { Task } from '../../db/types'
import { formatTime } from '../../lib/time'
import { DeleteDialog } from '../../components/DeleteDialog'
export function TodayView({ date, now, onEdit }: { date: string; now: Date; onEdit: (task: Task) => void }) {
  const items = useDayTasks(date, now)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [error, setError] = useState('')
  const run = async (work: () => Promise<unknown>) => { try { await work(); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not save change') } }
  const renderRows = (rows: DayItem[]) => <ul className="space-y-2">{rows.map(({ task, done, status }) => <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
    <input type="checkbox" checked={done} aria-label={`Mark ${task.title} ${done ? 'not done' : 'done'}`} className="h-5 w-5" onChange={e => { const checked = e.target.checked; void run(() => setDone(task.id, date, checked)) }} />
    <button className="min-w-0 flex-1 break-words text-left" onClick={() => onEdit(task)}><span className={done ? 'line-through text-slate-600 dark:text-slate-400' : ''}>{task.title}</span>{task.recurrence.type !== 'none' && <span className="ml-2 text-xs">(repeats)</span>}{task.notes && <span className="block text-sm">{task.notes}</span>}</button>
    {task.time && <span className="text-sm tabular-nums">{formatTime(task.time)}</span>}
    {status === 'missed' && <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-900 dark:bg-red-900 dark:text-red-100">Missed</span>}
    {done && <span className="sr-only">Done</span>}
    <button className="px-2 py-2 text-sm text-red-700 dark:text-red-300" aria-label={`Delete ${task.title}`} onClick={() => task.recurrence.type === 'none' ? void run(() => deleteTask(task.id)) : setDeleting(task)}>Delete</button>
  </li>)}</ul>
  const timed = (items ?? []).filter(i => i.task.time).sort((a, b) => a.task.time!.localeCompare(b.task.time!) || a.task.createdAt.localeCompare(b.task.createdAt))
  const anytime = (items ?? []).filter(i => !i.task.time).sort((a, b) => a.task.createdAt.localeCompare(b.task.createdAt))
  return <section className="mx-auto max-w-xl p-4 pb-28" aria-labelledby="today-heading">
    <h1 id="today-heading" className="mb-3 text-2xl font-semibold">Today</h1>
    <form className="mb-4" onSubmit={e => { e.preventDefault(); if (title.trim()) void run(async () => { await createTask({ title, startDate: date }); setTitle('') }) }}>
      <label htmlFor="quick" className="sr-only">Quick add task</label><input id="quick" value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task and press Enter" className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2 dark:bg-slate-800" />
    </form>
    {error && <p role="alert">{error}</p>}
    {!items && <p>Loading tasks…</p>}{items?.length === 0 && <p>Nothing yet. Add your first task.</p>}
    {timed.length > 0 && <><h2 className="mb-2 font-semibold">Scheduled</h2>{renderRows(timed)}</>}
    {anytime.length > 0 && <><h2 className="mb-2 mt-5 font-semibold">Anytime</h2>{renderRows(anytime)}</>}
    <DeleteDialog task={deleting} date={date} onClose={() => setDeleting(null)} />
  </section>
}
