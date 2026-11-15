import { describe, it, expect } from 'vitest'
import type { Task } from '../db/types'
import { effectiveOffset, planReminders } from './reminders'

const mk = (o: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Take meds', startDate: '2026-11-15', time: '09:00',
  recurrence: { type: 'none' }, reminderOffsetMin: 15,
  createdAt: '2026-11-15T00:00:00.000Z', updatedAt: '2026-11-15T00:00:00.000Z', ...o,
})
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)
const plan = (tasks: Task[], now: Date, extra: Partial<Parameters<typeof planReminders>[0]> = {}) =>
  planReminders({ tasks, doneKeys: new Set(), firedIds: new Set(), now, defaultOffset: null, ...extra })

describe('effectiveOffset', () => {
  it('uses the task value, then the default', () => {
    expect(effectiveOffset({ reminderOffsetMin: 30 }, 5)).toBe(30)
    expect(effectiveOffset({ reminderOffsetMin: null }, 5)).toBe(5)
    expect(effectiveOffset({ reminderOffsetMin: undefined }, null)).toBeNull()
  })
  it('-1 means none even if a default exists', () => {
    expect(effectiveOffset({ reminderOffsetMin: -1 }, 15)).toBeNull()
  })
  it('0 means at time', () => {
    expect(effectiveOffset({ reminderOffsetMin: 0 }, 15)).toBe(0)
  })
})

describe('planReminders', () => {
  it('schedules a reminder 15 minutes before', () => {
    const { scheduled, fireNow } = plan([mk()], at(15, 8))
    expect(fireNow).toHaveLength(0)
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].fireAt).toEqual(at(15, 8, 45))
  })
  it('fires at the due time for offset 0', () => {
    const { scheduled } = plan([mk({ reminderOffsetMin: 0 })], at(15, 8))
    expect(scheduled[0].fireAt).toEqual(at(15, 9))
  })
  it('skips tasks with no reminder, no time, or deleted', () => {
    const tasks = [mk({ id: 'a', reminderOffsetMin: -1 }), mk({ id: 'b', time: undefined }), mk({ id: 'c', deletedAt: 'x' })]
    const r = plan(tasks, at(15, 8))
    expect(r.scheduled).toHaveLength(0)
    expect(r.fireNow).toHaveLength(0)
  })
  it('uses the default offset when the task has none set', () => {
    const { scheduled } = plan([mk({ reminderOffsetMin: null })], at(15, 8), { defaultOffset: 30 })
    expect(scheduled[0].fireAt).toEqual(at(15, 8, 30))
  })
  it('skips occurrences already done', () => {
    const r = plan([mk()], at(15, 8), { doneKeys: new Set(['t1_2026-11-15']) })
    expect(r.scheduled).toHaveLength(0)
  })
  it('fires only once: already-fired ids are excluded', () => {
    const first = plan([mk()], at(15, 8)).scheduled[0]
    const again = plan([mk()], at(15, 8), { firedIds: new Set([first.id]) })
    expect(again.scheduled).toHaveLength(0)
    expect(again.fireNow).toHaveLength(0)
  })
  it('catches up when the app opens inside the reminder window', () => {
    const r = plan([mk()], at(15, 8, 50))
    expect(r.fireNow).toHaveLength(1)
    expect(r.scheduled).toHaveLength(0)
  })
  it('allows a short grace after the due time, then gives up', () => {
    expect(plan([mk()], at(15, 9, 4)).fireNow).toHaveLength(1)
    expect(plan([mk()], at(15, 9, 6)).fireNow).toHaveLength(0)
  })
  it('looks into tomorrow so early tasks remind the evening before', () => {
    const t = mk({ startDate: '2026-11-16', time: '00:30', reminderOffsetMin: 60 })
    const r = plan([t], at(15, 23))
    expect(r.scheduled).toHaveLength(1)
    expect(r.scheduled[0].date).toBe('2026-11-16')
    expect(r.scheduled[0].fireAt).toEqual(at(15, 23, 30))
  })
  it('generates one reminder per occurrence for recurring tasks and honors skipDates', () => {
    const t = mk({ recurrence: { type: 'daily', skipDates: ['2026-11-16'] } })
    const r = plan([t], at(15, 8))
    expect(r.scheduled.map(x => x.date)).toEqual(['2026-11-15'])
    const t2 = mk({ recurrence: { type: 'daily' } })
    expect(plan([t2], at(15, 8)).scheduled.map(x => x.date)).toEqual(['2026-11-15', '2026-11-16'])
  })
})

describe('multiple times a day', () => {
  const multi = mk({ times: ['09:00', '21:00'] })
  it('plans one reminder per time', () => {
    const r = plan([multi], at(15, 8))
    expect(r.scheduled.map(x => x.time)).toEqual(['09:00', '21:00'])
    expect(r.scheduled[1].fireAt).toEqual(at(15, 20, 45))
  })
  it('skips only the time that is already done', () => {
    const r = plan([multi], at(15, 8), { doneKeys: new Set(['t1_2026-11-15_09:00']) })
    expect(r.scheduled.map(x => x.time)).toEqual(['21:00'])
  })
  it('gives each time its own reminder id', () => {
    const ids = plan([multi], at(15, 8)).scheduled.map(x => x.id)
    expect(new Set(ids).size).toBe(2)
  })
})
