import { format } from 'date-fns'
import type { Recurrence } from '../db/types'
import { parseDateStr } from './dates'
import { dayOfWeek, intervalOf, nthWeekdayOf } from './recurrence'

// What the Repeat menu offers. Each one maps onto a recurrence type plus an interval.
export type RepeatPreset =
  | 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  | 'monthlyWeekday' | 'bimonthly' | 'quarterly' | 'yearly' | 'custom'
export type RepeatUnit = 'day' | 'week' | 'month' | 'year'

export const PRESET_ORDER: RepeatPreset[] = [
  'none', 'daily', 'weekdays', 'weekly', 'biweekly', 'semimonthly', 'monthly',
  'monthlyWeekday', 'bimonthly', 'quarterly', 'yearly', 'custom',
]

// "Bimonthly" can mean every two months or twice a month, so the menu says exactly what it means.
export const PRESET_LABELS: Record<RepeatPreset, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekdays: 'Weekdays (Mon–Fri)',
  weekly: 'Weekly on chosen days',
  biweekly: 'Every 2 weeks (biweekly)',
  semimonthly: 'Twice a month (semimonthly)',
  monthly: 'Monthly',
  monthlyWeekday: 'Monthly on a weekday (like the 2nd Tuesday)',
  bimonthly: 'Every 2 months (bimonthly)',
  quarterly: 'Every 3 months (quarterly)',
  yearly: 'Yearly',
  custom: 'Custom…',
}

// The state of the Repeat part of the task form.
export interface RepeatForm {
  preset: RepeatPreset
  every: number                 // custom only
  unit: RepeatUnit              // custom only
  days: number[]                // weekdays for weekly repeats; empty means the start date's weekday
  monthDays: number[]           // days of the month (-1 = last day); empty means the start date's day
  weekOfMonth: number | null    // monthly on a weekday; null means the start date's
  weekday: number | null        // monthly on a weekday; null means the start date's
  endDate: string               // empty means never
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_NAMES: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' }

export function ordinal(n: number): string {
  if (n === -1) return 'last day'
  const t = n % 100
  const suffix = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

const sortDays = (a: number[]) => [...a].sort((x, y) => (x === -1 ? 99 : x) - (y === -1 ? 99 : y))
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const clampEvery = (n: number) => Math.min(999, Math.max(1, Math.trunc(Number(n)) || 1))

export function presetOf(r: Recurrence): RepeatPreset {
  const n = intervalOf(r)
  if (r.type === 'none') return 'none'
  if (r.type === 'weekdays') return 'weekdays'
  if (r.type === 'daily') return n === 1 ? 'daily' : 'custom'
  if (r.type === 'weekly') return n === 1 ? 'weekly' : n === 2 ? 'biweekly' : 'custom'
  if (r.type === 'monthly') {
    if ((r.daysOfMonth?.length ?? 1) === 2) return n === 1 ? 'semimonthly' : 'custom'
    return n === 1 ? 'monthly' : n === 2 ? 'bimonthly' : n === 3 ? 'quarterly' : 'custom'
  }
  if (r.type === 'monthlyWeekday') return n === 1 ? 'monthlyWeekday' : 'custom'
  return n === 1 ? 'yearly' : 'custom'
}

export function unitOf(r: Recurrence): RepeatUnit {
  if (r.type === 'weekly') return 'week'
  if (r.type === 'monthly' || r.type === 'monthlyWeekday') return 'month'
  if (r.type === 'yearly') return 'year'
  return 'day'
}

export function formFromRecurrence(r?: Recurrence): RepeatForm {
  const rec: Recurrence = r ?? { type: 'none' }
  return {
    preset: presetOf(rec),
    every: intervalOf(rec),
    unit: unitOf(rec),
    days: rec.type === 'weekly' && rec.daysOfWeek?.length ? [...rec.daysOfWeek] : [],
    monthDays: rec.type === 'monthly' && rec.daysOfMonth?.length ? sortDays(rec.daysOfMonth) : [],
    weekOfMonth: rec.type === 'monthlyWeekday' ? rec.weekOfMonth ?? null : null,
    weekday: rec.type === 'monthlyWeekday' ? rec.daysOfWeek?.[0] ?? null : null,
    endDate: rec.endDate ?? '',
  }
}

// Builds the recurrence to save. skipDates and rescheduledDates of an existing task are kept as they are.
export function recurrenceFromForm(f: RepeatForm, startDate: string, keep?: Pick<Recurrence, 'skipDates' | 'rescheduledDates'>): Recurrence {
  const extras = { skipDates: keep?.skipDates, rescheduledDates: keep?.rescheduledDates }
  const withEnd = { ...extras, endDate: f.endDate || undefined }
  const weekDays = () => (f.days.length ? [...f.days].sort((a, b) => a - b) : [dayOfWeek(startDate)])
  const oneDay = () => (f.monthDays.length ? { daysOfMonth: [f.monthDays[0]] } : {})
  const every = (n: number) => (n > 1 ? { interval: n } : {})

  if (f.preset === 'none') return { type: 'none', ...extras }
  if (f.preset === 'daily') return { type: 'daily', ...withEnd }
  if (f.preset === 'weekdays') return { type: 'weekdays', ...withEnd }
  if (f.preset === 'weekly') return { type: 'weekly', daysOfWeek: weekDays(), ...withEnd }
  if (f.preset === 'biweekly') return { type: 'weekly', interval: 2, daysOfWeek: weekDays(), ...withEnd }
  if (f.preset === 'semimonthly') {
    const [a, b] = f.monthDays
    if (a === undefined || b === undefined || a === b) throw new Error('Pick two different days of the month.')
    return { type: 'monthly', daysOfMonth: sortDays([a, b]), ...withEnd }
  }
  if (f.preset === 'monthly') return { type: 'monthly', ...oneDay(), ...withEnd }
  if (f.preset === 'bimonthly') return { type: 'monthly', interval: 2, ...oneDay(), ...withEnd }
  if (f.preset === 'quarterly') return { type: 'monthly', interval: 3, ...oneDay(), ...withEnd }
  if (f.preset === 'monthlyWeekday') {
    return {
      type: 'monthlyWeekday',
      ...(f.weekOfMonth != null ? { weekOfMonth: f.weekOfMonth } : {}),
      ...(f.weekday != null ? { daysOfWeek: [f.weekday] } : {}),
      ...withEnd,
    }
  }
  if (f.preset === 'yearly') return { type: 'yearly', ...withEnd }
  if (f.preset === 'custom') {
    const n = clampEvery(f.every)
    if (f.unit === 'day') return { type: 'daily', ...every(n), ...withEnd }
    if (f.unit === 'week') return { type: 'weekly', ...every(n), daysOfWeek: weekDays(), ...withEnd }
    if (f.unit === 'month') return { type: 'monthly', ...every(n), ...oneDay(), ...withEnd }
    return { type: 'yearly', ...every(n), ...withEnd }
  }
  throw new Error('Unknown repeat option')
}

// A plain-language summary, like "Every 2 weeks on Monday and Friday, until Dec 31, 2026".
export function describeRecurrence(startDate: string, r: Recurrence): string {
  const n = intervalOf(r)
  const cycle = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`)
  let text: string
  if (r.type === 'none') return 'Does not repeat'
  if (r.type === 'daily') text = cycle('day')
  else if (r.type === 'weekdays') text = 'Every weekday (Mon–Fri)'
  else if (r.type === 'weekly') {
    const days = [...(r.daysOfWeek?.length ? r.daysOfWeek : [dayOfWeek(startDate)])].sort((a, b) => a - b)
    text = `${cycle('week')} on ${list(days.map(d => DAY_NAMES[d]))}`
  } else if (r.type === 'monthly') {
    const days = sortDays(r.daysOfMonth?.length ? r.daysOfMonth : [Number(startDate.slice(8, 10))])
    const names = list(days.map(ordinal))
    text = days.length === 2 && n === 1 ? `Twice a month, on the ${names}` : `${cycle('month')} on the ${names}`
  } else if (r.type === 'monthlyWeekday') {
    const week = r.weekOfMonth ?? nthWeekdayOf(startDate)
    const weekday = r.daysOfWeek?.[0] ?? dayOfWeek(startDate)
    text = `${cycle('month')} on the ${WEEK_NAMES[String(week)] ?? 'first'} ${DAY_NAMES[weekday]}`
  } else {
    text = `${cycle('year')} on ${format(parseDateStr(startDate), 'MMMM d')}`
  }
  if (r.endDate) text += `, until ${format(parseDateStr(r.endDate), 'MMM d, yyyy')}`
  return text
}
