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
import { Select } from './Select'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKS: Array<[number, string]> = [[1, 'First'], [2, 'Second'], [3, 'Third'], [4, 'Fourth'], [-1, 'Last']]
const MONTH_DAYS = [...Array.from({ length: 31 }, (_, i) => i + 1), -1]
const dayText = (n: number) => (n === -1 ? 'Last day of the month' : `The ${ordinal(n)}`)
const MONTH_DAY_OPTIONS = MONTH_DAYS.map(n => ({ value: String(n), label: dayText(n) }))
const REMINDER_OPTIONS = [
  { value: 'default', label: 'Use default setting' }, { value: '-1', label: 'No reminder' }, { value: '0', label: 'At time of task' },
  { value: '5', label: '5 minutes before' }, { value: '15', label: '15 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' },
]
const PRESET_OPTIONS = PRESET_ORDER.map(p => ({ value: p, label: PRESET_LABELS[p] }))
const WEEK_OPTIONS = [{ value: '', label: 'Same as the start date' }, ...WEEKS.map(([n, label]) => ({ value: String(n), label }))]
const WEEKDAY_OPTIONS = [{ value: '', label: 'Same as the start date' }, ...FULL_DAYS.map((label, d) => ({ value: String(d), label }))]
const ENDS_OPTIONS = [{ value: 'never', label: 'Never' }, { value: 'date', label: 'On a date' }]
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
    <Select label="Category" value={categoryId} onChange={setCategoryId}
      options={[{ value: '', label: 'No category' }, ...categories.map(c => ({ value: c.id, label: c.name })), { value: NEW_CATEGORY, label: 'New category…' }]} />
    {categoryId === NEW_CATEGORY && <label className="field-label">New category name<input required autoFocus maxLength={MAX_CATEGORY_NAME} value={newCategory} onChange={e => setNewCategory(e.target.value)} className="field mt-1" /></label>}
    <DatePicker label={isRepeating ? 'Starts' : 'Date'} required value={startDate} onChange={setStartDate} />
    <TimePicker label="Time (optional)" value={first} onChange={v => setSlotTimes(cur => v ? [v, ...cur.slice(1)] : [])} />
    {slotTimes.length > 0 && <div className="space-y-2">
      {slotTimes.slice(1).map((t, i) => <div key={i} className="flex items-end gap-2">
        <TimePicker label={`Time ${i + 2}`} className="flex-1" required value={t} onChange={v => setSlotTimes(cur => cur.map((x, j) => j === i + 1 ? v : x))} />
        <button type="button" className="btn-text-error" aria-label={`Remove time ${i + 2}`} onClick={() => setSlotTimes(cur => cur.filter((_, j) => j !== i + 1))}>Remove</button>
      </div>)}
      {slotTimes.length < MAX_TIMES && <button type="button" className="btn-tonal" onClick={() => setSlotTimes(cur => [...cur, ''])}>Add another time</button>}
      {distinct > 1 && <p className="text-sm text-on-surface-variant">This task will appear {distinct} times each day, and each time is checked off separately.{task && !task.times?.length && isRepeating ? ' The extra times start today, so earlier days are not changed.' : ''}</p>}
    </div>}
    {first && <button type="button" className="btn-text" onClick={() => setSlotTimes([])}>Clear time</button>}
    {first && deriveStatus({ date: startDate, time: first, done: false, now: new Date() }) === 'missed' && <p role="status" className="rounded-m3-sm bg-tertiary-container p-3 text-sm text-on-tertiary-container">This time has passed. The occurrence will show as missed unless completed.</p>}
    {first && <Select label="Reminder" value={reminder} onChange={setReminder} options={REMINDER_OPTIONS} />}

    <Select label="Repeat" value={repeat.preset} onChange={v => choosePreset(v as RepeatPreset)} options={PRESET_OPTIONS} />
    {repeat.preset === 'custom' && <div className="flex items-end gap-2">
      <label className="field-label w-24">Every<input type="number" min={1} max={999} required value={repeat.every || ''} onChange={e => setForm({ every: Number(e.target.value) })} className="field mt-1" /></label>
      <Select label="Unit" className="flex-1" value={repeat.unit} onChange={v => setForm({ unit: v as RepeatUnit })}
        options={(['day', 'week', 'month', 'year'] as const).map(u => ({ value: u, label: repeat.every === 1 ? u : `${u}s` }))} />
    </div>}
    {showWeekDays && <fieldset><legend className="field-label mb-2">On these days</legend><div className="flex flex-wrap gap-2">{DAYS.map((label, day) => <label key={day} className={`chip ${repeat.days.includes(day) ? 'chip-selected' : ''}`}><input type="checkbox" className="sr-only" checked={repeat.days.includes(day)} onChange={() => setForm({ days: repeat.days.includes(day) ? repeat.days.filter(d => d !== day) : [...repeat.days, day].sort((a, b) => a - b) })} />{label}</label>)}</div><p className="mt-2 text-sm text-on-surface-variant">If none are selected, uses the start date’s weekday.</p></fieldset>}
    {showMonthDay && <Select label="On day" value={String(repeat.monthDays[0] ?? '')} onChange={v => setForm({ monthDays: v === '' ? [] : [Number(v)] })}
      options={[{ value: '', label: 'Same day as the start date' }, ...MONTH_DAY_OPTIONS]} />}
    {repeat.preset === 'semimonthly' && <div className="grid grid-cols-2 gap-3">
      <Select label="First day" value={String(repeat.monthDays[0] ?? 1)} onChange={v => setMonthDay(0, Number(v))} options={MONTH_DAY_OPTIONS} />
      <Select label="Second day" value={String(repeat.monthDays[1] ?? 15)} onChange={v => setMonthDay(1, Number(v))} options={MONTH_DAY_OPTIONS} />
    </div>}
    {repeat.preset === 'monthlyWeekday' && <div className="grid grid-cols-2 gap-3">
      <Select label="Which week" value={String(repeat.weekOfMonth ?? '')} onChange={v => setForm({ weekOfMonth: v === '' ? null : Number(v) })} options={WEEK_OPTIONS} />
      <Select label="Weekday" value={String(repeat.weekday ?? '')} onChange={v => setForm({ weekday: v === '' ? null : Number(v) })} options={WEEKDAY_OPTIONS} />
    </div>}
    {isRepeating && <div className="space-y-3">
      <Select label="Ends" value={endsOn ? 'date' : 'never'} onChange={v => setEndsOn(v === 'date')} options={ENDS_OPTIONS} />
      {endsOn && <DatePicker label="Last day" required min={startDate} value={repeat.endDate} onChange={v => setForm({ endDate: v })} />}
      {summary && <p role="status" className="rounded-m3-sm bg-surface-container-high p-3 text-sm text-on-surface">{summary}{preview && intervalOf(preview) > 1 ? '. Counting starts from the start date.' : ''}</p>}
    </div>}
    {task && task.recurrence.type !== 'none' && <p className="text-sm text-on-surface-variant">Edits apply to the whole series, including historical labels and schedules. Existing completion records remain unchanged.</p>}
    {error && <p role="alert" className="text-error">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-text" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-filled">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>
}
