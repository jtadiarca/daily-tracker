import { useEffect, useRef, useState } from 'react'
import type { Category, Recurrence, Task } from '../db/types'
import { createTask, updateTask } from '../db/repo'
import { createCategory } from '../db/categoryRepo'
import { MAX_CATEGORY_NAME, findCategoryByName } from '../lib/categories'
import { todayStr } from '../lib/dates'
import { intervalOf } from '../lib/recurrence'
import {
  PRESET_LABELS, PRESET_ORDER, describeRecurrence, formFromRecurrence, ordinal, recurrenceFromForm,
  type RepeatForm, type RepeatPreset, type RepeatUnit,
} from '../lib/repeat'
import { deriveStatus } from '../lib/status'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKS: Array<[number, string]> = [[1, 'First'], [2, 'Second'], [3, 'Third'], [4, 'Fourth'], [-1, 'Last']]
const MONTH_DAYS = [...Array.from({ length: 31 }, (_, i) => i + 1), -1]
const dayText = (n: number) => (n === -1 ? 'Last day of the month' : `The ${ordinal(n)}`)
const MAX_TIMES = 12
const NEW_CATEGORY = '__new__'
const EMPTY_FORM = formFromRecurrence()
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/
export function TaskSheet({ open, task, date, categories, defaultCategoryId, onClose }: {
  open: boolean; task: Task | null; date: string; categories: Category[]; defaultCategoryId?: string; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  // '' means no category, NEW_CATEGORY means "create one now" (named in newCategory), anything else is a category id.
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [startDate, setStartDate] = useState(date)
  // All times of day for this task. The first one is the main time, the rest are extra times.
  const [slotTimes, setSlotTimes] = useState<string[]>([])
  const [reminder, setReminder] = useState('default')
  const [repeat, setRepeat] = useState<RepeatForm>(EMPTY_FORM)
  const [endsOn, setEndsOn] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    setTitle(task?.title ?? ''); setNotes(task?.notes ?? ''); setStartDate(task?.startDate ?? date)
    // A task whose category was deleted opens as "No category".
    const wanted = task ? task.categoryId : defaultCategoryId
    setCategoryId(wanted && categories.some(c => c.id === wanted) ? wanted : ''); setNewCategory('')
    setSlotTimes(task?.times && task.times.length >= 2 ? [...task.times].sort() : task?.time ? [task.time] : [])
    setRepeat(formFromRecurrence(task?.recurrence)); setEndsOn(!!task?.recurrence.endDate); setError('')
    setReminder(task?.reminderOffsetMin == null ? 'default' : String(task.reminderOffsetMin))
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [open, task])
  const setForm = (patch: Partial<RepeatForm>) => setRepeat(cur => ({ ...cur, ...patch }))
  const choosePreset = (preset: RepeatPreset) => setRepeat(cur => ({
    ...cur, preset,
    every: preset === 'custom' && cur.every < 2 ? 2 : cur.every,
    monthDays: preset === 'semimonthly' && cur.monthDays.length < 2 ? [1, 15] : cur.monthDays,
  }))
  const setMonthDay = (index: number, value: number) => setRepeat(cur => { const next = [...cur.monthDays]; next[index] = value; return { ...cur, monthDays: next } })

  const first = slotTimes[0] ?? ''
  const distinct = new Set(slotTimes.filter(Boolean)).size
  const isRepeating = repeat.preset !== 'none'
  const showWeekDays = repeat.preset === 'weekly' || repeat.preset === 'biweekly' || (repeat.preset === 'custom' && repeat.unit === 'week')
  const showMonthDay = repeat.preset === 'monthly' || repeat.preset === 'bimonthly' || repeat.preset === 'quarterly' || (repeat.preset === 'custom' && repeat.unit === 'month')
  const formForSave: RepeatForm = { ...repeat, endDate: endsOn ? repeat.endDate : '' }
  let preview: Recurrence | null = null
  let summary = ''
  try {
    if (isRepeating && DATE_OK.test(startDate)) { preview = recurrenceFromForm(formForSave, startDate); summary = describeRecurrence(startDate, preview) }
  } catch (e) { summary = e instanceof Error ? e.message : '' }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || saving) return
    setSaving(true); setError('')
    try {
      if (isRepeating && endsOn && (!repeat.endDate || repeat.endDate < startDate)) throw new Error('The last day must be on or after the start date.')
      const recurrence = recurrenceFromForm(formForSave, startDate, task?.recurrence)
      const clean = [...new Set(slotTimes.filter(Boolean))].sort()
      let time: string | undefined = clean[0]
      let times: string[] | undefined
      let timesFrom: string | undefined
      if (clean.length >= 2) {
        times = clean
        if (task?.times && task.times.length >= 2) { time = task.time; timesFrom = task.timesFrom }
        else if (task && isRepeating) { time = task.time; timesFrom = startDate > todayStr() ? startDate : todayStr() }
      }
      const reminderOffsetMin = clean.length > 0 && reminder !== 'default' ? Number(reminder) : null
      let chosenCategory: string | undefined = categoryId || undefined
      if (categoryId === NEW_CATEGORY) {
        // Reuse a category that already has this name instead of failing on a duplicate.
        chosenCategory = (findCategoryByName(categories, newCategory) ?? await createCategory(newCategory)).id
      }
      const data = { title: title.trim(), notes: notes.trim() || undefined, categoryId: chosenCategory, startDate, time, times, timesFrom, recurrence, reminderOffsetMin }
      if (task) await updateTask(task.id, data); else await createTask(data)
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') } finally { setSaving(false) }
  }
  return <dialog ref={dialog} aria-labelledby="task-heading" onCancel={e => { e.preventDefault(); if (!saving) onClose() }} className="sheet">
    <form onSubmit={save} className="space-y-4"><h2 id="task-heading" className="text-2xl">{task ? 'Edit task' : 'New task'}</h2>
    <label className="field-label">Title<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Category<select className="field mt-1" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
      <option value="">No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value={NEW_CATEGORY}>New category…</option></select></label>
    {categoryId === NEW_CATEGORY && <label className="field-label">New category name<input required autoFocus maxLength={MAX_CATEGORY_NAME} value={newCategory} onChange={e => setNewCategory(e.target.value)} className="field mt-1" /></label>}
    <label className="field-label">{isRepeating ? 'Starts' : 'Date'}<input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="field mt-1" /></label>
    <label className="field-label">Time (optional)<input type="time" value={first} onChange={e => setSlotTimes(cur => e.target.value ? [e.target.value, ...cur.slice(1)] : [])} className="field mt-1" /></label>
    {slotTimes.length > 0 && <div className="space-y-2">
      {slotTimes.slice(1).map((t, i) => <div key={i} className="flex items-end gap-2">
        <label className="field-label flex-1">Time {i + 2}<input type="time" required value={t} onChange={e => setSlotTimes(cur => cur.map((x, j) => j === i + 1 ? e.target.value : x))} className="field mt-1" /></label>
        <button type="button" className="btn-text-error" aria-label={`Remove time ${i + 2}`} onClick={() => setSlotTimes(cur => cur.filter((_, j) => j !== i + 1))}>Remove</button>
      </div>)}
      {slotTimes.length < MAX_TIMES && <button type="button" className="btn-tonal" onClick={() => setSlotTimes(cur => [...cur, ''])}>Add another time</button>}
      {distinct > 1 && <p className="text-sm text-on-surface-variant">This task will appear {distinct} times each day, and each time is checked off separately.{task && !task.times?.length && isRepeating ? ' The extra times start today, so earlier days are not changed.' : ''}</p>}
    </div>}
    {first && <button type="button" className="btn-text" onClick={() => setSlotTimes([])}>Clear time</button>}
    {first && deriveStatus({ date: startDate, time: first, done: false, now: new Date() }) === 'missed' && <p role="status" className="rounded-m3-sm bg-tertiary-container p-3 text-sm text-on-tertiary-container">This time has passed. The occurrence will show as missed unless completed.</p>}
    {first && <label className="field-label">Reminder<select className="field mt-1" value={reminder} onChange={e => setReminder(e.target.value)}>
      <option value="default">Use default setting</option><option value="-1">No reminder</option><option value="0">At time of task</option>
      <option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>}

    <label className="field-label">Repeat<select className="field mt-1" value={repeat.preset} onChange={e => choosePreset(e.target.value as RepeatPreset)}>{PRESET_ORDER.map(p => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}</select></label>
    {repeat.preset === 'custom' && <div className="flex items-end gap-2">
      <label className="field-label w-24">Every<input type="number" min={1} max={999} required value={repeat.every || ''} onChange={e => setForm({ every: Number(e.target.value) })} className="field mt-1" /></label>
      <label className="field-label flex-1">Unit<select className="field mt-1" value={repeat.unit} onChange={e => setForm({ unit: e.target.value as RepeatUnit })}>
        <option value="day">{repeat.every === 1 ? 'day' : 'days'}</option><option value="week">{repeat.every === 1 ? 'week' : 'weeks'}</option><option value="month">{repeat.every === 1 ? 'month' : 'months'}</option><option value="year">{repeat.every === 1 ? 'year' : 'years'}</option></select></label>
    </div>}
    {showWeekDays && <fieldset><legend className="field-label mb-2">On these days</legend><div className="flex flex-wrap gap-2">{DAYS.map((label, day) => <label key={day} className={`chip ${repeat.days.includes(day) ? 'chip-selected' : ''}`}><input type="checkbox" className="sr-only" checked={repeat.days.includes(day)} onChange={() => setForm({ days: repeat.days.includes(day) ? repeat.days.filter(d => d !== day) : [...repeat.days, day].sort((a, b) => a - b) })} />{label}</label>)}</div><p className="mt-2 text-sm text-on-surface-variant">If none are selected, uses the start date’s weekday.</p></fieldset>}
    {showMonthDay && <label className="field-label">On day<select className="field mt-1" value={repeat.monthDays[0] ?? ''} onChange={e => setForm({ monthDays: e.target.value === '' ? [] : [Number(e.target.value)] })}>
      <option value="">Same day as the start date</option>{MONTH_DAYS.map(n => <option key={n} value={n}>{dayText(n)}</option>)}</select></label>}
    {repeat.preset === 'semimonthly' && <div className="grid grid-cols-2 gap-3">
      <label className="field-label">First day<select className="field mt-1" value={repeat.monthDays[0] ?? 1} onChange={e => setMonthDay(0, Number(e.target.value))}>{MONTH_DAYS.map(n => <option key={n} value={n}>{dayText(n)}</option>)}</select></label>
      <label className="field-label">Second day<select className="field mt-1" value={repeat.monthDays[1] ?? 15} onChange={e => setMonthDay(1, Number(e.target.value))}>{MONTH_DAYS.map(n => <option key={n} value={n}>{dayText(n)}</option>)}</select></label>
    </div>}
    {repeat.preset === 'monthlyWeekday' && <div className="grid grid-cols-2 gap-3">
      <label className="field-label">Which week<select className="field mt-1" value={repeat.weekOfMonth ?? ''} onChange={e => setForm({ weekOfMonth: e.target.value === '' ? null : Number(e.target.value) })}><option value="">Same as the start date</option>{WEEKS.map(([n, label]) => <option key={n} value={n}>{label}</option>)}</select></label>
      <label className="field-label">Weekday<select className="field mt-1" value={repeat.weekday ?? ''} onChange={e => setForm({ weekday: e.target.value === '' ? null : Number(e.target.value) })}><option value="">Same as the start date</option>{FULL_DAYS.map((label, d) => <option key={d} value={d}>{label}</option>)}</select></label>
    </div>}
    {isRepeating && <div className="space-y-3">
      <label className="field-label">Ends<select className="field mt-1" value={endsOn ? 'date' : 'never'} onChange={e => setEndsOn(e.target.value === 'date')}><option value="never">Never</option><option value="date">On a date</option></select></label>
      {endsOn && <label className="field-label">Last day<input type="date" required min={startDate} value={repeat.endDate} onChange={e => setForm({ endDate: e.target.value })} className="field mt-1" /></label>}
      {summary && <p role="status" className="rounded-m3-sm bg-surface-container-high p-3 text-sm text-on-surface">{summary}{preview && intervalOf(preview) > 1 ? '. Counting starts from the start date.' : ''}</p>}
    </div>}
    {task && task.recurrence.type !== 'none' && <p className="text-sm text-on-surface-variant">Edits apply to the whole series, including historical labels and schedules. Existing completion records remain unchanged.</p>}
    {error && <p role="alert" className="text-error">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-text" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-filled">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>
}
