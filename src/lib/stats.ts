import type { Category, Task } from '../db/types'
import { categoryOf, FILTER_NONE } from './categories'
import { addDaysStr } from './dates'
import { occursOn } from './recurrence'
import { isSlotDone, rescheduleKey, slotsOf, type Slot } from './slots'
import { deriveStatus } from './status'

export interface DayStat { date: string; total: number; done: number; missed: number; rate: number | null }
export interface MissedItem { task: Task; date: string; slot: Slot }

// Streaks look back at most this many days (about 3 years) to keep the dashboard fast.
export const STREAK_MAX_DAYS = 1095

// Every time a task has to be done counts as its own occurrence.
export function dayStat(tasks: Task[], doneKeys: Set<string>, date: string, now: Date): DayStat {
  let total = 0, done = 0, missed = 0
  for (const t of tasks) {
    if (t.deletedAt || !occursOn(t, date)) continue
    for (const slot of slotsOf(t, date)) {
      total++
      if (isSlotDone(doneKeys, t, date, slot)) done++
      else if (deriveStatus({ date, time: slot ?? undefined, done: false, now }) === 'missed') missed++
    }
  }
  return { date, total, done, missed, rate: total ? done / total : null }
}

export function rangeStats(tasks: Task[], doneKeys: Set<string>, from: string, to: string, now: Date): DayStat[] {
  const out: DayStat[] = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(dayStat(tasks, doneKeys, d, now))
  return out
}

// Missed occurrences that still need action: not done, past due, and not already rescheduled. Newest first.
export function missedOccurrences(tasks: Task[], doneKeys: Set<string>, from: string, to: string, now: Date): MissedItem[] {
  const out: MissedItem[] = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    for (const t of tasks) {
      if (t.deletedAt || !occursOn(t, d)) continue
      for (const slot of slotsOf(t, d)) {
        if (isSlotDone(doneKeys, t, d, slot) || t.recurrence.rescheduledDates?.includes(rescheduleKey(t, d, slot))) continue
        if (deriveStatus({ date: d, time: slot ?? undefined, done: false, now }) === 'missed') out.push({ task: t, date: d, slot })
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (b.slot ?? '').localeCompare(a.slot ?? ''))
}

export interface CategoryStat { key: string; category: Category | null; total: number; done: number; missed: number; rate: number | null }

// Totals per category over a date range, in category order with "No category" last.
// Categories with nothing scheduled in the range are left out.
export function categoryBreakdown(tasks: Task[], doneKeys: Set<string>, live: Category[], from: string, to: string, now: Date): CategoryStat[] {
  const rows: CategoryStat[] = live.map(category => ({ key: category.id, category, total: 0, done: 0, missed: 0, rate: null }))
  const none: CategoryStat = { key: FILTER_NONE, category: null, total: 0, done: 0, missed: 0, rate: null }
  const byId = new Map(rows.map(r => [r.key, r]))
  const rowOf = new Map(tasks.map(t => [t.id, byId.get(categoryOf(t, live)?.id ?? '') ?? none]))
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    for (const t of tasks) {
      if (t.deletedAt || !occursOn(t, d)) continue
      const row = rowOf.get(t.id)!
      for (const slot of slotsOf(t, d)) {
        row.total++
        if (isSlotDone(doneKeys, t, d, slot)) row.done++
        else if (deriveStatus({ date: d, time: slot ?? undefined, done: false, now }) === 'missed') row.missed++
      }
    }
  }
  return [...rows, none]
    .filter(r => r.total > 0)
    .map(r => ({ ...r, rate: r.done / r.total }))
}

export function streakWindowStart(tasks: Task[], today: string): string {
  const starts = tasks.filter(t => !t.deletedAt).map(t => t.startDate)
  const earliest = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : today
  const floor = addDaysStr(today, -(STREAK_MAX_DAYS - 1))
  return earliest < floor ? floor : earliest > today ? today : earliest
}

// days: ascending, ending at today. A streak day has tasks and all of them done.
// Days with no tasks are neutral. An unfinished today neither breaks nor extends the streak.
export function computeStreaks(days: DayStat[], today: string): { current: number; best: number } {
  let best = 0, run = 0
  for (const d of days) {
    if (d.total === 0) continue
    if (d.done === d.total) { run++; if (run > best) best = run }
    else if (d.date !== today) run = 0
  }
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]
    if (d.total === 0) continue
    if (d.done === d.total) current++
    else if (d.date !== today) break
  }
  return { current, best }
}
