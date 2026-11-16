import { describe, expect, it } from 'vitest'
import { clampDate, dateForKey, inRange, monthGrid, monthHasDays, monthStart, shiftMonths, withMonth, withYear, yearRange } from './calendar'

describe('monthGrid', () => {
  it('lays out November 2026 in Sunday-first weeks', () => {
    const g = monthGrid(2026, 10)
    expect(g[0]).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
    expect(g).toHaveLength(5)
    expect(g[4]).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null])
  })
  it('pads the first week when the month starts mid-week', () => {
    const g = monthGrid(2026, 1) // February 2026 starts on a Sunday and has 28 days
    expect(g).toHaveLength(4)
    const g2 = monthGrid(2024, 1) // February 2024 starts on a Thursday
    expect(g2[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(g2[0][4]).toBe('2024-02-01')
    expect(g2.flat().filter(Boolean)).toHaveLength(29)
    expect(g2.every(w => w.length === 7)).toBe(true)
  })
})

describe('ranges', () => {
  it('checks and clamps against min and max', () => {
    expect(inRange('2026-05-05', '2026-05-01', '2026-05-10')).toBe(true)
    expect(inRange('2026-04-30', '2026-05-01')).toBe(false)
    expect(inRange('2026-05-11', undefined, '2026-05-10')).toBe(false)
    expect(clampDate('2026-04-30', '2026-05-01')).toBe('2026-05-01')
    expect(clampDate('2026-06-01', undefined, '2026-05-10')).toBe('2026-05-10')
    expect(clampDate('2026-05-05')).toBe('2026-05-05')
  })
  it('knows whether a month has any allowed day', () => {
    expect(monthHasDays(2026, 4, '2026-05-31')).toBe(true)
    expect(monthHasDays(2026, 3, '2026-05-01')).toBe(false)
    expect(monthHasDays(2026, 5, undefined, '2026-05-31')).toBe(false)
  })
  it('offers the allowed years, or 50 either side', () => {
    expect(yearRange(2026, '2024-03-01', '2026-01-01')).toEqual([2024, 2025, 2026])
    const r = yearRange(2026)
    expect(r).toContain(1976)
    expect(r).toContain(2076)
  })
})

describe('moving between dates', () => {
  it('keeps the day inside shorter months and years', () => {
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(withYear('2024-02-29', 2025)).toBe('2025-02-28')
    expect(withMonth('2026-03-31', 3)).toBe('2026-04-30')
    expect(monthStart(2026, 10)).toBe('2026-11-01')
  })
  it('maps keys to dates', () => {
    expect(dateForKey('2026-11-15', 'ArrowLeft')).toBe('2026-11-14')
    expect(dateForKey('2026-11-30', 'ArrowRight')).toBe('2026-12-01')
    expect(dateForKey('2026-11-15', 'ArrowUp')).toBe('2026-11-08')
    expect(dateForKey('2026-11-15', 'ArrowDown')).toBe('2026-11-22')
    expect(dateForKey('2026-11-18', 'Home')).toBe('2026-11-15') // Sunday
    expect(dateForKey('2026-11-18', 'End')).toBe('2026-11-21') // Saturday
    expect(dateForKey('2026-03-31', 'PageUp')).toBe('2026-02-28')
    expect(dateForKey('2026-11-15', 'PageDown', true)).toBe('2027-11-15')
    expect(dateForKey('2026-11-15', 'Enter')).toBeNull()
  })
})
