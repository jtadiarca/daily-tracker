import { describe, it, expect } from 'vitest'
import type { Task } from '../db/types'
import { addDaysStr } from './dates'
import { computeStreaks, dayStat, missedOccurrences, rangeStats, streakWindowStart, type DayStat } from './stats'

const mk = (o: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Task', startDate: '2026-11-15', recurrence: { type: 'none' },
  createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...o,
})
const at = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m)

// x = all done, o = not done, - = no tasks. One char per consecutive day.
const seq = (start: string, states: string): DayStat[] =>
  [...states].map((c, i) => ({
    date: addDaysStr(start, i),
    total: c === '-' ? 0 : 1,
    done: c === 'x' ? 1 : 0,
    missed: 0,
    rate: c === '-' ? null : c === 'x' ? 1 : 0,
  }))

describe('dayStat', () => {
  it('counts done, total and rate', () => {
    const tasks = [mk({ id: 'a' }), mk({ id: 'b' })]
    const s = dayStat(tasks, new Set(['a_2026-11-15']), '2026-11-15', at(15))
    expect(s).toMatchObject({ total: 2, done: 1, rate: 0.5 })
  })
  it('has a null rate when nothing is scheduled', () => {
    expect(dayStat([mk()], new Set(), '2026-11-16', at(16)).rate).toBeNull()
  })
  it('counts timed tasks past their time as missed', () => {
    const s = dayStat([mk({ time: '09:00' })], new Set(), '2026-11-15', at(15, 12))
    expect(s.missed).toBe(1)
  })
  it('ignores deleted tasks', () => {
    expect(dayStat([mk({ deletedAt: 'x' })], new Set(), '2026-11-15', at(15)).total).toBe(0)
  })
})

describe('rangeStats', () => {
  it('includes both ends of the range', () => {
    expect(rangeStats([mk()], new Set(), '2026-11-13', '2026-11-15', at(15))).toHaveLength(3)
  })
  it('returns nothing for a backwards range', () => {
    expect(rangeStats([mk()], new Set(), '2026-11-15', '2026-11-13', at(15))).toHaveLength(0)
  })
})

describe('computeStreaks', () => {
  it('does not break the streak for an unfinished today', () => {
    expect(computeStreaks(seq('2026-11-10', 'xxxxxo'), '2026-11-15')).toEqual({ current: 5, best: 5 })
  })
  it('counts today once it is complete', () => {
    expect(computeStreaks(seq('2026-11-10', 'xxxxxx'), '2026-11-15')).toEqual({ current: 6, best: 6 })
  })
  it('breaks on a past day with unfinished tasks and tracks the best run', () => {
    expect(computeStreaks(seq('2026-11-08', 'xxxxoxx'), '2026-11-14')).toEqual({ current: 2, best: 4 })
  })
  it('treats days with no tasks as neutral', () => {
    expect(computeStreaks(seq('2026-11-10', 'x-x'), '2026-11-12')).toEqual({ current: 2, best: 2 })
  })
  it('is zero with no tasks at all', () => {
    expect(computeStreaks(seq('2026-11-10', '---'), '2026-11-12')).toEqual({ current: 0, best: 0 })
  })
  it('a past miss resets the current streak even if today is done', () => {
    expect(computeStreaks(seq('2026-11-12', 'xoxx'), '2026-11-15')).toEqual({ current: 2, best: 2 })
  })
})

describe('missedOccurrences', () => {
  const daily = mk({ id: 'd', startDate: '2026-11-12', recurrence: { type: 'daily', rescheduledDates: ['2026-11-12'] } })
  it('lists past undone occurrences, newest first, skipping done and rescheduled ones', () => {
    const out = missedOccurrences([daily], new Set(['d_2026-11-13']), '2026-11-10', '2026-11-15', at(15))
    expect(out.map(m => m.date)).toEqual(['2026-11-14'])
  })
  it('does not list today untimed tasks or future dates', () => {
    const t = mk({ id: 'u', startDate: '2026-11-15' })
    expect(missedOccurrences([t], new Set(), '2026-11-15', '2026-11-20', at(15))).toHaveLength(0)
  })
  it('lists a timed task earlier today once its time has passed', () => {
    const t = mk({ id: 'm', time: '09:00' })
    expect(missedOccurrences([t], new Set(), '2026-11-15', '2026-11-15', at(15, 12))).toHaveLength(1)
  })
})

describe('multiple times a day', () => {
  const multi = mk({ id: 'm', time: '08:00', times: ['08:00', '20:00'] })
  it('counts each time as its own occurrence', () => {
    const s = dayStat([multi], new Set(['m_2026-11-15_08:00']), '2026-11-15', at(15, 12))
    expect(s).toMatchObject({ total: 2, done: 1, missed: 0, rate: 0.5 })
  })
  it('marks only the passed, unchecked time as missed', () => {
    expect(dayStat([multi], new Set(), '2026-11-15', at(15, 12)).missed).toBe(1)
  })
  it('lists missed occurrences per time, latest time first', () => {
    const out = missedOccurrences([multi], new Set(), '2026-11-15', '2026-11-15', at(15, 21))
    expect(out.map(m => m.slot)).toEqual(['20:00', '08:00'])
  })
  it('hides only the rescheduled time', () => {
    const t = mk({ id: 'm', time: '08:00', times: ['08:00', '20:00'], recurrence: { type: 'none', rescheduledDates: ['2026-11-15@08:00'] } })
    const out = missedOccurrences([t], new Set(), '2026-11-15', '2026-11-15', at(15, 21))
    expect(out.map(m => m.slot)).toEqual(['20:00'])
  })
  it('keeps earlier days single-time until timesFrom', () => {
    const t = mk({ id: 'r', startDate: '2026-11-10', recurrence: { type: 'daily' }, time: '08:00', times: ['08:00', '20:00'], timesFrom: '2026-11-15' })
    expect(dayStat([t], new Set(), '2026-11-14', at(15)).total).toBe(1)
    expect(dayStat([t], new Set(), '2026-11-15', at(15, 12)).total).toBe(2)
  })
})

describe('streakWindowStart', () => {
  it('uses the earliest task start, or today when there are no tasks', () => {
    expect(streakWindowStart([mk({ startDate: '2026-10-01' }), mk({ startDate: '2026-11-01' })], '2026-11-15')).toBe('2026-10-01')
    expect(streakWindowStart([], '2026-11-15')).toBe('2026-11-15')
  })
})
