import { describe, it, expect } from 'vitest'
import { todayStr, addDaysStr, parseDateStr, completionId } from './dates'

describe('dates', () => {
  it('uses local day, not UTC', () => {
    expect(todayStr(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15')
    expect(todayStr(new Date(2026, 10, 16, 0, 0))).toBe('2026-11-16')
  })
  it('adds days across month/DST boundaries', () => {
    expect(addDaysStr('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDaysStr('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('parses as local midnight', () => {
    const d = parseDateStr('2026-11-15')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 15, 0])
  })
  it('builds completion ids', () => {
    expect(completionId('abc', '2026-11-15')).toBe('abc_2026-11-15')
  })
})
