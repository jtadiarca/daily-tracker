import { useEffect, useRef, useState } from 'react'
import type { Task, RecurrenceType } from '../db/types'
import { createTask, updateTask } from '../db/repo'
import { dayOfWeek } from '../lib/recurrence'
import { todayStr } from '../lib/dates'
import { deriveStatus } from '../lib/status'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_TIMES = 12
export function TaskSheet({ open, task, date, onClose }: { open: boolean; task: Task | null; date: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState(date)
  // All times of day for this task. The first one is the main time, the rest are extra times.
  const [slotTimes, setSlotTimes] = useState<string[]>([])
  const [reminder, setReminder] = useState('default')
  const [type, setType] = useState<RecurrenceType>('none')
  const [days, setDays] = useState<number[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    setTitle(task?.title ?? ''); setNotes(task?.notes ?? ''); setStartDate(task?.startDate ?? date)
    setSlotTimes(task?.times && task.times.length >= 2 ? [...task.times].sort() : task?.time ? [task.time] : [])
    setType(task?.recurrence.type ?? 'none'); setDays(task?.recurrence.daysOfWeek ?? []); setError('')
    setReminder(task?.reminderOffsetMin == null ? 'default' : String(task.reminderOffsetMin))
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [open, task])
  const first = slotTimes[0] ?? ''
  const distinct = new Set(slotTimes.filter(Boolean)).size
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || saving) return
    setSaving(true); setError('')
    try {
      const clean = [...new Set(slotTimes.filter(Boolean))].sort()
      let time: string | undefined = clean[0]
      let times: string[] | undefined
      let timesFrom: string | undefined
      if (clean.length >= 2) {
        times = clean
        if (task?.times && task.times.length >= 2) { time = task.time; timesFrom = task.timesFrom }
        else if (task && type !== 'none') { time = task.time; timesFrom = startDate > todayStr() ? startDate : todayStr() }
      }
      const recurrence = { ...task?.recurrence, type, daysOfWeek: type === 'weekly' ? (days.length ? days : [dayOfWeek(startDate)]) : undefined }
      const reminderOffsetMin = clean.length > 0 && reminder !== 'default' ? Number(reminder) : null
      const data = { title: title.trim(), notes: notes.trim() || undefined, startDate, time, times, timesFrom, recurrence, reminderOffsetMin }
      if (task) await updateTask(task.id, data); else await createTask(data)
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') } finally { setSaving(false) }
  }
  return <dialog ref={dialog} aria-labelledby="task-heading" onCancel={e => { e.preventDefault(); if (!saving) onClose() }} className="sheet">
    <form onSubmit={save} className="space-y-4"><h2 id="task-heading" className="text-2xl">{task ? 'Edit task' : 'New task'}</h2>
    <label className="field-label">Title<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">{type === 'none' ? 'Date' : 'Starts'}<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Time (optional)<input type="time" value={first} onChange={e => setSlotTimes(cur => e.target.value ? [e.target.value, ...cur.slice(1)] : [])} className="field mt-1" /></label>
    {slotTimes.length > 0 && <div className="space-y-2">
      {slotTimes.slice(1).map((t, i) => <div key={i} className="flex items-end gap-2">
        <label className="field-label flex-1">Time {i + 2}<input type="time" required value={t} onChange={e => setSlotTimes(cur => cur.map((x, j) => j === i + 1 ? e.target.value : x))} className="field mt-1" /></label>
        <button type="button" className="btn-text-error" aria-label={`Remove time ${i + 2}`} onClick={() => setSlotTimes(cur => cur.filter((_, j) => j !== i + 1))}>Remove</button>
      </div>)}
      {slotTimes.length < MAX_TIMES && <button type="button" className="btn-tonal" onClick={() => setSlotTimes(cur => [...cur, ''])}>Add another time</button>}
      {distinct > 1 && <p className="text-sm text-on-surface-variant">This task will appear {distinct} times each day, and each time is checked off separately.{task && !task.times?.length && type !== 'none' ? ' The extra times start today, so earlier days are not changed.' : ''}</p>}
    </div>}
    {first && <button type="button" className="btn-text" onClick={() => setSlotTimes([])}>Clear time</button>}
    {first && deriveStatus({ date: startDate, time: first, done: false, now: new Date() }) === 'missed' && <p role="status" className="rounded-m3-sm bg-tertiary-container p-3 text-sm text-on-tertiary-container">This time has passed. The occurrence will show as missed unless completed.</p>}
    {first && <label className="field-label">Reminder<select className="field mt-1" value={reminder} onChange={e => setReminder(e.target.value)}>
      <option value="default">Use default setting</option><option value="-1">No reminder</option><option value="0">At time of task</option>
      <option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>}
    <label className="field-label">Repeat<select className="field mt-1" value={type} onChange={e => setType(e.target.value as RecurrenceType)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays (Mon–Fri)</option><option value="weekly">Weekly on chosen days</option></select></label>
    {type === 'weekly' && <fieldset><legend className="field-label mb-2">On these days</legend><div className="flex flex-wrap gap-2">{DAYS.map((label, day) => <label key={day} className={`chip ${days.includes(day) ? 'chip-selected' : ''}`}><input type="checkbox" className="sr-only" checked={days.includes(day)} onChange={() => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort())} />{label}</label>)}</div><p className="mt-2 text-sm text-on-surface-variant">If none are selected, uses the start date’s weekday.</p></fieldset>}
    {task && task.recurrence.type !== 'none' && <p className="text-sm text-on-surface-variant">Edits apply to the whole series, including historical labels and schedules. Existing completion records remain unchanged.</p>}
    {error && <p role="alert" className="text-error">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-text" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-filled">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>
}
