import type { Task } from '../db/types'
import { addDaysStr, parseDateStr } from './dates'
export const dayOfWeek = (date: string) => parseDateStr(date).getDay()
export function occursOn(task: Pick<Task, 'startDate' | 'recurrence'>, date: string): boolean {
  const r = task.recurrence
  if (date < task.startDate || (r.endDate && date > r.endDate) || r.skipDates?.includes(date)) return false
  switch (r.type) {
    case 'none': return date === task.startDate
    case 'daily': return true
    case 'weekdays': return dayOfWeek(date) >= 1 && dayOfWeek(date) <= 5
    case 'weekly': return (r.daysOfWeek?.length ? r.daysOfWeek : [dayOfWeek(task.startDate)]).includes(dayOfWeek(date))
  }
}
export function occurrencesBetween(task: Pick<Task, 'startDate' | 'recurrence'>, from: string, to: string): string[] {
  const dates: string[] = []
  for (let d = from < task.startDate ? task.startDate : from; d <= to; d = addDaysStr(d, 1)) if (occursOn(task, d)) dates.push(d)
  return dates
}
