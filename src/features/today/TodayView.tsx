import { useState } from 'react'
import { useDayTasks } from './useToday'
import { createTask, deleteTask, setDone } from '../../db/repo'
import type { Task } from '../../db/types'

export function TodayView({ date, onEdit }: { date: string; onEdit: (t: Task) => void }) {
  const items = useDayTasks(date)
  const [title, setTitle] = useState('')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({ title, startDate: date })
    setTitle('')
  }

  return (
    <section aria-labelledby="today-h" className="p-4 pb-28 max-w-xl mx-auto">
      <h1 id="today-h" className="text-2xl font-semibold mb-3">Today</h1>
      <form onSubmit={add} className="mb-4">
        <label htmlFor="quick" className="sr-only">Quick add task</label>
        <input id="quick" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Add a task and press Enter"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2" />
      </form>
      {items?.length === 0 && <p className="text-slate-600 dark:text-slate-400">Nothing yet. Add your first task.</p>}
      <ul className="space-y-2">
        {items?.map(({ task, done }) => (
          <li key={task.id} className="flex items-center gap-3 rounded-lg bg-white dark:bg-slate-800 p-3 shadow-sm">
            <input type="checkbox" checked={done} aria-label={`Mark "${task.title}" done`}
              className="h-5 w-5" onChange={e => setDone(task.id, date, e.target.checked)} />
            <button className="flex-1 text-left" onClick={() => onEdit(task)}>
              <span className={done ? 'line-through text-slate-500' : ''}>{task.title}</span>
              {done && <span className="sr-only"> (done)</span>}
              {task.notes && <span className="block text-sm text-slate-500">{task.notes}</span>}
            </button>
            <button aria-label={`Delete "${task.title}"`} className="text-sm text-red-700 dark:text-red-400 px-2"
              onClick={() => deleteTask(task.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
