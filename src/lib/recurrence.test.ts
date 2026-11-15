import { describe, it, expect } from 'vitest'
import type { Recurrence } from '../db/types'
import { occursOn, occurrencesBetween } from './recurrence'
const task = (recurrence: Recurrence, startDate = '2026-11-15') => ({ startDate, recurrence })
describe('recurrence', () => {
  it('generates a one-off only on its date', () => {
    expect(occursOn(task({ type: 'none' }), '2026-11-15')).toBe(true)
    expect(occursOn(task({ type: 'none' }), '2026-11-16')).toBe(false)
  })
  it('never generates before the start', () => expect(occursOn(task({ type: 'daily' }), '2026-11-14')).toBe(false))
  it('generates daily occurrences', () => expect(occurrencesBetween(task({ type: 'daily' }), '2026-11-15', '2026-11-18')).toHaveLength(4))
  it('excludes weekends', () => expect(occurrencesBetween(task({ type: 'weekdays' }), '2026-11-15', '2026-11-22')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']))
  it('uses chosen weekdays', () => expect(occurrencesBetween(task({ type: 'weekly', daysOfWeek: [1, 3] }), '2026-11-15', '2026-11-22')).toEqual(['2026-11-16', '2026-11-18']))
  it('falls back to the start weekday', () => expect(occurrencesBetween(task({ type: 'weekly' }), '2026-11-15', '2026-11-30')).toEqual(['2026-11-15', '2026-11-22', '2026-11-29']))
  it('honors inclusive end dates and exceptions', () => expect(occurrencesBetween(task({ type: 'daily', endDate: '2026-11-17', skipDates: ['2026-11-16'] }), '2026-11-15', '2026-11-20')).toEqual(['2026-11-15', '2026-11-17']))
  it('crosses a DST boundary without losing dates', () => expect(occurrencesBetween(task({ type: 'daily' }, '2026-10-30'), '2026-10-30', '2026-11-03')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']))
})
