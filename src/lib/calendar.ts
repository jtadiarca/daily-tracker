import { addDays, addMonths, endOfMonth, getDaysInMonth, startOfMonth } from 'date-fns'
import { parseDateStr, toDateStr } from './dates'

// Helpers for the Material 3 date picker. Dates are 'yyyy-MM-dd' strings, as everywhere else in the app.

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The first day of a month, as 'yyyy-MM-01'. month is 0-11. */
export const monthStart = (year: number, month: number) => toDateStr(new Date(year, month, 1))

/**
 * The days of one month laid out in weeks that start on Sunday.
 * Days before the 1st and after the last day are null, so every week has 7 cells.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1)
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null)
  const days = getDaysInMonth(first)
  for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** True when the date is inside the optional min and max (both inclusive). */
export const inRange = (date: string, min?: string, max?: string) => (!min || date >= min) && (!max || date <= max)

/** Moves a date into the optional min and max. */
export function clampDate(date: string, min?: string, max?: string): string {
  if (min && date < min) return min
  if (max && date > max) return max
  return date
}

/** Same day in another month, kept inside that month (Jan 31 + 1 month = Feb 28 or 29). */
export const shiftMonths = (date: string, n: number) => toDateStr(addMonths(parseDateStr(date), n))

/** Same day and month in another year, kept inside that month (Feb 29 -> Feb 28). */
export function withYear(date: string, year: number): string {
  const d = parseDateStr(date)
  const last = getDaysInMonth(new Date(year, d.getMonth(), 1))
  return toDateStr(new Date(year, d.getMonth(), Math.min(d.getDate(), last)))
}

/** Same day of the month in another month of the same year, kept inside that month. */
export function withMonth(date: string, month: number): string {
  const d = parseDateStr(date)
  const last = getDaysInMonth(new Date(d.getFullYear(), month, 1))
  return toDateStr(new Date(d.getFullYear(), month, Math.min(d.getDate(), last)))
}

/**
 * Where keyboard focus goes in the day grid for a key press, or null for keys the grid doesn't handle.
 * Arrows move by a day or a week, Home/End go to the start or end of the week, Page Up/Down go to the
 * previous or next month (with Shift: year).
 */
export function dateForKey(date: string, key: string, shift = false): string | null {
  const d = parseDateStr(date)
  switch (key) {
    case 'ArrowLeft': return toDateStr(addDays(d, -1))
    case 'ArrowRight': return toDateStr(addDays(d, 1))
    case 'ArrowUp': return toDateStr(addDays(d, -7))
    case 'ArrowDown': return toDateStr(addDays(d, 7))
    case 'Home': return toDateStr(addDays(d, -d.getDay()))
    case 'End': return toDateStr(addDays(d, 6 - d.getDay()))
    case 'PageUp': return shiftMonths(date, shift ? -12 : -1)
    case 'PageDown': return shiftMonths(date, shift ? 12 : 1)
    default: return null
  }
}

/** True when some day of the month is inside the optional min and max. */
export function monthHasDays(year: number, month: number, min?: string, max?: string): boolean {
  const first = toDateStr(startOfMonth(new Date(year, month, 1)))
  const last = toDateStr(endOfMonth(new Date(year, month, 1)))
  return (!min || last >= min) && (!max || first <= max)
}

/** The years the year list offers: the allowed range, or 50 years either side of the shown year. */
export function yearRange(shown: number, min?: string, max?: string): number[] {
  const from = min ? Number(min.slice(0, 4)) : Math.min(shown, new Date().getFullYear()) - 50
  const to = max ? Number(max.slice(0, 4)) : Math.max(shown, new Date().getFullYear()) + 50
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}
