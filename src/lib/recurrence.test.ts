import { describe, it, expect } from 'vitest'
import type { Recurrence } from '../db/types'
import { intervalOf, nthWeekdayOf, occursOn, occurrencesBetween } from './recurrence'
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

describe('intervals', () => {
  it('treats a missing, zero or fractional interval as 1', () => {
    expect(intervalOf({})).toBe(1)
    expect(intervalOf({ interval: 0 })).toBe(1)
    expect(intervalOf({ interval: 1.5 })).toBe(1)
    expect(intervalOf({ interval: 3 })).toBe(3)
  })
  it('repeats every 3 days from the start date', () => {
    expect(occurrencesBetween(task({ type: 'daily', interval: 3 }), '2026-11-15', '2026-11-30')).toEqual(['2026-11-15', '2026-11-18', '2026-11-21', '2026-11-24', '2026-11-27', '2026-11-30'])
  })
  it('repeats every 2 weeks on chosen days, counting weeks from the start', () => {
    expect(occurrencesBetween(task({ type: 'weekly', interval: 2, daysOfWeek: [1, 5] }, '2026-11-16'), '2026-11-15', '2026-12-06')).toEqual(['2026-11-16', '2026-11-20', '2026-11-30', '2026-12-04'])
  })
  it('repeats every 2 weeks on the start weekday by default', () => {
    expect(occurrencesBetween(task({ type: 'weekly', interval: 2 }), '2026-11-15', '2026-12-15')).toEqual(['2026-11-15', '2026-11-29', '2026-12-13'])
  })
  it('does not count days before the start inside the first week', () => {
    expect(occurrencesBetween(task({ type: 'weekly', interval: 2, daysOfWeek: [1, 3] }, '2026-11-18'), '2026-11-15', '2026-12-05')).toEqual(['2026-11-18', '2026-11-30', '2026-12-02'])
  })
})

describe('monthly', () => {
  it('uses the start date day, and the last day in shorter months', () => {
    expect(occurrencesBetween(task({ type: 'monthly' }, '2026-01-31'), '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })
  it('uses a chosen day and crosses the year end', () => {
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [15] }), '2026-11-01', '2027-02-28')).toEqual(['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15'])
  })
  it('supports the last day of the month, including a leap February', () => {
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [-1] }, '2026-01-01'), '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [-1] }, '2028-01-01'), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29'])
  })
  it('repeats twice a month on two days', () => {
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [1, 15] }, '2026-11-10'), '2026-11-10', '2026-12-31')).toEqual(['2026-11-15', '2026-12-01', '2026-12-15'])
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [15, -1] }, '2026-02-01'), '2026-02-01', '2026-03-31')).toEqual(['2026-02-15', '2026-02-28', '2026-03-15', '2026-03-31'])
  })
  it('lists a date once when two chosen days land on the same short-month day', () => {
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [30, 31] }, '2026-02-01'), '2026-02-01', '2026-02-28')).toEqual(['2026-02-28'])
  })
  it('repeats every 2 months and every 3 months', () => {
    expect(occurrencesBetween(task({ type: 'monthly', interval: 2 }), '2026-11-01', '2027-05-31')).toEqual(['2026-11-15', '2027-01-15', '2027-03-15', '2027-05-15'])
    expect(occurrencesBetween(task({ type: 'monthly', interval: 3 }), '2026-11-01', '2027-12-31')).toEqual(['2026-11-15', '2027-02-15', '2027-05-15', '2027-08-15', '2027-11-15'])
  })
  it('honors the end date and skipped dates', () => {
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [15], endDate: '2026-12-15' }), '2026-11-01', '2027-03-01')).toEqual(['2026-11-15', '2026-12-15'])
    expect(occurrencesBetween(task({ type: 'monthly', daysOfMonth: [15], skipDates: ['2026-12-15'] }), '2026-11-01', '2027-01-31')).toEqual(['2026-11-15', '2027-01-15'])
  })
})

describe('monthly on a weekday', () => {
  it('finds the nth weekday of the start date by default', () => {
    expect(nthWeekdayOf('2026-11-10')).toBe(2)
    expect(nthWeekdayOf('2026-11-07')).toBe(1)
    expect(nthWeekdayOf('2026-11-28')).toBe(4)
    expect(nthWeekdayOf('2026-11-30')).toBe(-1)
    expect(occurrencesBetween(task({ type: 'monthlyWeekday' }, '2026-11-10'), '2026-11-01', '2027-01-31')).toEqual(['2026-11-10', '2026-12-08', '2027-01-12'])
  })
  it('supports the last weekday of the month', () => {
    expect(occurrencesBetween(task({ type: 'monthlyWeekday', weekOfMonth: -1, daysOfWeek: [5] }, '2026-11-01'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-27', '2026-12-25'])
  })
  it('treats a fifth weekday as the last one', () => {
    expect(occurrencesBetween(task({ type: 'monthlyWeekday' }, '2026-11-30'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-30', '2026-12-28'])
  })
})

describe('yearly', () => {
  it('falls on February 28 in years without a leap day', () => {
    expect(occurrencesBetween(task({ type: 'yearly' }, '2024-02-29'), '2024-01-01', '2028-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })
  it('repeats every 2 years', () => {
    expect(occurrencesBetween(task({ type: 'yearly', interval: 2 }), '2026-01-01', '2031-12-31')).toEqual(['2026-11-15', '2028-11-15', '2030-11-15'])
  })
})
