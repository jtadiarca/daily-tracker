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
  return <dialog ref={dialog} aria-labelledby="task-heading" onCancel={e => { e.preventDefault(); if (!saving) onClose() }} className="sheet">
    <form onSubmit={save} className="space-y-4"><h2 id="task-heading" className="text-2xl">{task ? 'Edit task' : 'New task'}</h2>
    <label className="field-label">Title<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">{type === 'none' ? 'Date' : 'Starts'}<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Time (optional)<input type="time" value={time} onChange={e => setTime(e.target.value)} className="field mt-1" /></label>
    {time && <button type="button" className="btn-text" onClick={() => setTime('')}>Clear time</button>}
    {time && deriveStatus({ date: startDate, time, done: false, now: new Date() }) === 'missed' && <p role="status" className="rounded-m3-sm bg-tertiary-container p-3 text-sm text-on-tertiary-container">This time has passed. The occurrence will show as missed unless completed.</p>}
    {time && <label className="field-label">Reminder<select className="field mt-1" value={reminder} onChange={e => setReminder(e.target.value)}>
      <option value="default">Use default setting</option><option value="-1">No reminder</option><option value="0">At time of task</option>
      <option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>}
    <label className="field-label">Repeat<select className="field mt-1" value={type} onChange={e => setType(e.target.value as RecurrenceType)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays (Mon–Fri)</option><option value="weekly">Weekly on chosen days</option></select></label>
    {type === 'weekly' && <fieldset><legend className="field-label mb-2">On these days</legend><div className="flex flex-wrap gap-2">{DAYS.map((label, day) => <label key={day} className={`chip ${days.includes(day) ? 'chip-selected' : ''}`}><input type="checkbox" className="sr-only" checked={days.includes(day)} onChange={() => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort())} />{label}</label>)}</div><p className="mt-2 text-sm text-on-surface-variant">If none are selected, uses the start date’s weekday.</p></fieldset>}
    {task && task.recurrence.type !== 'none' && <p className="text-sm text-on-surface-variant">Edits apply to the whole series, including historical labels and schedules. Existing completion records remain unchanged.</p>}
    {error && <p role="alert" className="text-error">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-text" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-filled">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>
}
