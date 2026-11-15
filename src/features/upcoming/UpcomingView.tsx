import { useMemo } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Task } from '../../db/types'
import { addDaysStr, completionId, parseDateStr } from '../../lib/dates'
import { occursOn } from '../../lib/recurrence'
import { formatTime } from '../../lib/time'

const DAYS_AHEAD = 14

export function UpcomingView({ date, onEdit }: { date: string; onEdit: (t: Task) => void }) {
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
      items: data.tasks.filter(t => occursOn(t, d))
        .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.createdAt.localeCompare(b.createdAt))
        .map(task => ({ task, done: done.has(completionId(task.id, d)) })),
    })).filter(g => g.items.length > 0)
  }, [data, date])

  const label = (d: string) => (d === date ? 'Today' : d === addDaysStr(date, 1) ? 'Tomorrow' : format(parseDateStr(d), 'EEEE, MMM d'))

  return (
    <section aria-labelledby="up-h" className="mx-auto max-w-xl space-y-5 p-4 pb-28">
      <h1 id="up-h" className="text-2xl font-semibold">Upcoming</h1>
      <p className="text-sm">The next {DAYS_AHEAD} days. Tap a task to edit it.</p>
      {data && groups.length === 0 && <p>Nothing scheduled in the next {DAYS_AHEAD} days.</p>}
      {groups.map(g => (
        <section key={g.date} aria-labelledby={`up-${g.date}`}>
          <h2 id={`up-${g.date}`} className="mb-2 font-semibold">{label(g.date)}</h2>
          <ul className="space-y-2">
            {g.items.map(({ task, done }) => (
              <li key={task.id}>
                <button className="flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left shadow-sm dark:bg-slate-800" onClick={() => onEdit(task)}>
                  <span className="w-20 shrink-0 text-sm tabular-nums">{task.time ? formatTime(task.time) : 'Anytime'}</span>
                  <span className={`min-w-0 flex-1 break-words ${done ? 'line-through text-slate-600 dark:text-slate-400' : ''}`}>{task.title}</span>
                  {done && <span className="text-sm">Done</span>}
                  {task.recurrence.type !== 'none' && <span className="text-xs">(repeats)</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
