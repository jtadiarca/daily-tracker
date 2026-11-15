import type { Task } from '../db/types'
import { completionId } from './dates'

// A slot is one time of day a task has to be done (HH:mm), or null for a task without a time.
export type Slot = string | null
type SlotTask = Pick<Task, 'id' | 'time' | 'times' | 'timesFrom'>

// The times a task appears on a given date. `times` only applies from `timesFrom`, so adding
// extra times to an existing repeating task does not rewrite earlier days.
export function slotsOf(task: Pick<Task, 'time' | 'times' | 'timesFrom'>, date: string): Slot[] {
  if (task.times && task.times.length >= 2 && (!task.timesFrom || date >= task.timesFrom)) {
    return [...new Set(task.times)].sort()
  }
  return [task.time ?? null]
}

export const isMultiSlot = (task: Pick<Task, 'time' | 'times' | 'timesFrom'>, date: string) => slotsOf(task, date).length > 1

// Single-time and untimed tasks keep the old completion id, so existing data stays valid.
export const completionSlot = (task: Pick<Task, 'time' | 'times' | 'timesFrom'>, date: string, slot: Slot): Slot =>
  isMultiSlot(task, date) ? slot : null

export const doneKey = (task: SlotTask, date: string, slot: Slot): string =>
  completionId(task.id, date, completionSlot(task, date, slot) ?? undefined)

export const isSlotDone = (doneKeys: Set<string>, task: SlotTask, date: string, slot: Slot): boolean =>
  doneKeys.has(doneKey(task, date, slot))

// Used in recurrence.rescheduledDates: a plain date, or date@HH:mm when the task has several times.
export function rescheduleKey(task: Pick<Task, 'time' | 'times' | 'timesFrom'>, date: string, slot: Slot): string {
  const s = completionSlot(task, date, slot)
  return s ? `${date}@${s}` : date
}
