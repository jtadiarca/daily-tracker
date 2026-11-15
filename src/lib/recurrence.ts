import { differenceInCalendarDays } from 'date-fns'
import type { Recurrence, Task } from '../db/types'
import { addDaysStr, parseDateStr } from './dates'

export const dayOfWeek = (date: string) => parseDateStr(date).getDay()

const parts = (s: string) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) })
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()
const monthsBetween = (from: string, to: string) => {
  const a = parts(from), b = parts(to)
  return (b.y - a.y) * 12 + (b.m - a.m)
}

// Every N days, weeks, months or years. Anything that is not a whole number of at least 1 counts as 1.
export const intervalOf = (r: Pick<Recurrence, 'interval'>): number =>
  Number.isInteger(r.interval) && (r.interval as number) >= 1 ? (r.interval as number) : 1

// Which weekday of the month a date is: 1 to 4, or -1 when it is the fifth (which is always the last).
export function nthWeekdayOf(date: string): number {
  const n = Math.ceil(parts(date).d / 7)
  return n >= 5 ? -1 : n
}

export function occursOn(task: Pick<Task, 'startDate' | 'recurrence'>, date: string): boolean {
  const r = task.recurrence
  if (date < task.startDate || (r.endDate && date > r.endDate) || r.skipDates?.includes(date)) return false
  const n = intervalOf(r)
  switch (r.type) {
    case 'none': return date === task.startDate
    case 'daily': return differenceInCalendarDays(parseDateStr(date), parseDateStr(task.startDate)) % n === 0
    case 'weekdays': return dayOfWeek(date) >= 1 && dayOfWeek(date) <= 5
    case 'weekly': {
      // Weeks start on Sunday and are counted from the week that contains the start date.
      const firstWeek = parseDateStr(addDaysStr(task.startDate, -dayOfWeek(task.startDate)))
      const week = Math.floor(differenceInCalendarDays(parseDateStr(date), firstWeek) / 7)
      const days = r.daysOfWeek?.length ? r.daysOfWeek : [dayOfWeek(task.startDate)]
      return week % n === 0 && days.includes(dayOfWeek(date))
    }
    case 'monthly': {
      if (monthsBetween(task.startDate, date) % n !== 0) return false
      const { y, m, d } = parts(date)
      const last = daysInMonth(y, m)
      const days = r.daysOfMonth?.length ? r.daysOfMonth : [parts(task.startDate).d]
      // A day that does not exist in a short month (like the 31st) falls on the last day of that month.
      return days.some(x => (x === -1 ? last : Math.min(x, last)) === d)
    }
    case 'monthlyWeekday': {
      if (monthsBetween(task.startDate, date) % n !== 0) return false
      if (dayOfWeek(date) !== (r.daysOfWeek?.[0] ?? dayOfWeek(task.startDate))) return false
      const { y, m, d } = parts(date)
      const week = r.weekOfMonth ?? nthWeekdayOf(task.startDate)
      return week === -1 ? d + 7 > daysInMonth(y, m) : Math.ceil(d / 7) === week
    }
    case 'yearly': {
      const s = parts(task.startDate), p = parts(date)
      if ((p.y - s.y) % n !== 0 || p.m !== s.m) return false
      // February 29 falls on February 28 in years without a leap day.
      return p.d === Math.min(s.d, daysInMonth(p.y, p.m))
    }
  }
}

export function occurrencesBetween(task: Pick<Task, 'startDate' | 'recurrence'>, from: string, to: string): string[] {
  const dates: string[] = []
  for (let d = from < task.startDate ? task.startDate : from; d <= to; d = addDaysStr(d, 1)) if (occursOn(task, d)) dates.push(d)
  return dates
}
