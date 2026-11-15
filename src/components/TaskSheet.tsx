import { useEffect, useRef, useState } from 'react'
import type { Task, RecurrenceType } from '../db/types'
import { createTask, updateTask } from '../db/repo'
import { dayOfWeek } from '../lib/recurrence'
import { deriveStatus } from '../lib/status'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function TaskSheet({ open, task, date, onClose }: { open: boolean; task: Task | null; date: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState(date)
  const [time, setTime] = useState('')
  const [reminder, setReminder] = useState('default')
  const [type, setType] = useState<RecurrenceType>('none')
  const [days, setDays] = useState<number[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    setTitle(task?.title ?? ''); setNotes(task?.notes ?? ''); setStartDate(task?.startDate ?? date)
    setTime(task?.time ?? ''); setType(task?.recurrence.type ?? 'none'); setDays(task?.recurrence.daysOfWeek ?? []); setError('')
    setReminder(task?.reminderOffsetMin == null ? 'default' : String(task.reminderOffsetMin))
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [open, task])
  const field = 'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 dark:bg-slate-800'
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || saving) return
    setSaving(true); setError('')
    try {
      const recurrence = { ...task?.recurrence, type, daysOfWeek: type === 'weekly' ? (days.length ? days : [dayOfWeek(startDate)]) : undefined }
      const reminderOffsetMin = time && reminder !== 'default' ? Number(reminder) : null
      const data = { title: title.trim(), notes: notes.trim() || undefined, startDate, time: time || undefined, recurrence, reminderOffsetMin }
      if (task) await updateTask(task.id, data); else await createTask(data)
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') } finally { setSaving(false) }
  }
  return <dialog ref={dialog} aria-labelledby="task-heading" onCancel={e => { e.preventDefault(); if (!saving) onClose() }} className="fixed bottom-0 top-auto m-0 mx-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-900 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
    <form onSubmit={save} className="space-y-3"><h2 id="task-heading" className="text-lg font-semibold">{task ? 'Edit task' : 'New task'}</h2>
    <label className="block">Title<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} className={field} /></label>
    <label className="block">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={field} /></label>
    <label className="block">{type === 'none' ? 'Date' : 'Starts'}<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className={field} /></label>
    <label className="block">Time (optional)<input type="time" value={time} onChange={e => setTime(e.target.value)} className={field} /></label>
    {time && <button type="button" className="underline" onClick={() => setTime('')}>Clear time</button>}
    {time && deriveStatus({ date: startDate, time, done: false, now: new Date() }) === 'missed' && <p role="status">This time has passed. The occurrence will show as missed unless completed.</p>}
    {time && <label className="block">Reminder<select className={field} value={reminder} onChange={e => setReminder(e.target.value)}>
      <option value="default">Use default setting</option><option value="-1">No reminder</option><option value="0">At time of task</option>
      <option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>}
    <label className="block">Repeat<select className={field} value={type} onChange={e => setType(e.target.value as RecurrenceType)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays (Mon–Fri)</option><option value="weekly">Weekly on chosen days</option></select></label>
    {type === 'weekly' && <fieldset><legend>On these days</legend><div className="flex flex-wrap gap-3">{DAYS.map((label, day) => <label key={day} className="flex items-center gap-1 py-2"><input type="checkbox" checked={days.includes(day)} onChange={() => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort())} />{label}</label>)}</div><p className="text-sm">If none are selected, uses the start date’s weekday.</p></fieldset>}
    {task && task.recurrence.type !== 'none' && <p className="text-sm">Edits apply to the whole series, including historical labels and schedules. Existing completion records remain unchanged.</p>}
    {error && <p role="alert">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="px-4 py-2" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="rounded bg-indigo-700 px-4 py-2 text-white">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>
}
