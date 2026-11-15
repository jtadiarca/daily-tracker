import { useEffect, useState } from 'react'
import type { Task } from '../db/types'
import { createTask, updateTask } from '../db/repo'

export function TaskSheet({ open, task, date, onClose }:
  { open: boolean; task: Task | null; date: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [d, setD] = useState(date)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? ''); setNotes(task?.notes ?? ''); setD(task?.startDate ?? date)
  }, [open, task, date])

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (task) await updateTask(task.id, { title: title.trim(), notes: notes.trim() || undefined, startDate: d })
    else await createTask({ title, notes, startDate: d })
    onClose()
  }
  const field = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2'
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={task ? 'Edit task' : 'Add task'}
        onClick={e => e.stopPropagation()} onSubmit={save}
        className="w-full max-w-xl mx-auto rounded-t-2xl bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="text-lg font-semibold">{task ? 'Edit task' : 'New task'}</h2>
        <label className="block">Title<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} className={field} /></label>
        <label className="block">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={field} /></label>
        <label className="block">Date<input type="date" value={d} onChange={e => setD(e.target.value)} className={field} /></label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-700 text-white">Save</button>
        </div>
      </form>
    </div>
  )
}
