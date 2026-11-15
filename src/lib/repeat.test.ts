import { describe, it, expect } from 'vitest'
import type { Recurrence } from '../db/types'
import { PRESET_ORDER, describeRecurrence, formFromRecurrence, ordinal, presetOf, recurrenceFromForm, type RepeatForm } from './repeat'

const form = (over: Partial<RepeatForm> = {}): RepeatForm => ({
  preset: 'daily', every: 2, unit: 'day', days: [], monthDays: [], weekOfMonth: null, weekday: null, endDate: '', ...over,
})
const START = '2026-11-15'

describe('presets', () => {
  it('round-trips every menu option except custom', () => {
    for (const preset of PRESET_ORDER.filter(p => p !== 'custom')) {
      const rec = recurrenceFromForm(form({ preset, monthDays: preset === 'semimonthly' ? [1, 15] : [] }), START)
      expect(presetOf(rec)).toBe(preset)
      expect(formFromRecurrence(rec).preset).toBe(preset)
    }
  })
  it('maps the named options onto a type and an interval', () => {
    expect(recurrenceFromForm(form({ preset: 'biweekly', days: [5, 1] }), START)).toMatchObject({ type: 'weekly', interval: 2, daysOfWeek: [1, 5] })
    expect(recurrenceFromForm(form({ preset: 'bimonthly' }), START)).toMatchObject({ type: 'monthly', interval: 2 })
    expect(recurrenceFromForm(form({ preset: 'quarterly' }), START)).toMatchObject({ type: 'monthly', interval: 3 })
    expect(recurrenceFromForm(form({ preset: 'semimonthly', monthDays: [15, 1] }), START)).toMatchObject({ type: 'monthly', daysOfMonth: [1, 15] })
    expect(recurrenceFromForm(form({ preset: 'semimonthly', monthDays: [15, -1] }), START)).toMatchObject({ daysOfMonth: [15, -1] })
  })
  it('keeps a weekly repeat on the start weekday when no day is picked', () => {
    expect(recurrenceFromForm(form({ preset: 'weekly' }), START).daysOfWeek).toEqual([0])
  })
  it('leaves the day of the month open so it follows the start date', () => {
    expect(recurrenceFromForm(form({ preset: 'monthly' }), START).daysOfMonth).toBeUndefined()
    expect(recurrenceFromForm(form({ preset: 'monthly', monthDays: [20] }), START).daysOfMonth).toEqual([20])
  })
  it('requires two different days for twice a month', () => {
    expect(() => recurrenceFromForm(form({ preset: 'semimonthly', monthDays: [10] }), START)).toThrow(/two different days/)
    expect(() => recurrenceFromForm(form({ preset: 'semimonthly', monthDays: [10, 10] }), START)).toThrow(/two different days/)
  })
  it('builds custom repeats for each unit and normalizes interval 1', () => {
    expect(recurrenceFromForm(form({ preset: 'custom', every: 3, unit: 'day' }), START)).toMatchObject({ type: 'daily', interval: 3 })
    expect(recurrenceFromForm(form({ preset: 'custom', every: 4, unit: 'week', days: [1] }), START)).toMatchObject({ type: 'weekly', interval: 4, daysOfWeek: [1] })
    expect(recurrenceFromForm(form({ preset: 'custom', every: 6, unit: 'month' }), START)).toMatchObject({ type: 'monthly', interval: 6 })
    expect(recurrenceFromForm(form({ preset: 'custom', every: 2, unit: 'year' }), START)).toMatchObject({ type: 'yearly', interval: 2 })
    expect(recurrenceFromForm(form({ preset: 'custom', every: 1, unit: 'week' }), START).interval).toBeUndefined()
    expect(presetOf(recurrenceFromForm(form({ preset: 'custom', every: 6, unit: 'month' }), START))).toBe('custom')
    expect(recurrenceFromForm(form({ preset: 'custom', every: 5000, unit: 'day' }), START).interval).toBe(999)
  })
  it('saves the end date, and keeps skipped and rescheduled dates', () => {
    const keep = { skipDates: ['2026-11-16'], rescheduledDates: ['2026-11-17'] }
    const rec = recurrenceFromForm(form({ preset: 'daily', endDate: '2026-12-31' }), START, keep)
    expect(rec).toMatchObject({ type: 'daily', endDate: '2026-12-31', ...keep })
    expect(recurrenceFromForm(form({ preset: 'daily' }), START).endDate).toBeUndefined()
  })
  it('drops the end date when the task does not repeat', () => {
    expect(recurrenceFromForm(form({ preset: 'none', endDate: '2026-12-31' }), START).endDate).toBeUndefined()
  })
  it('reads an existing recurrence back into the form', () => {
    const rec: Recurrence = { type: 'monthlyWeekday', weekOfMonth: -1, daysOfWeek: [5], endDate: '2027-01-31' }
    expect(formFromRecurrence(rec)).toMatchObject({ preset: 'monthlyWeekday', weekOfMonth: -1, weekday: 5, endDate: '2027-01-31' })
    expect(formFromRecurrence(undefined).preset).toBe('none')
  })
})

describe('describeRecurrence', () => {
  it('describes weekly and biweekly repeats', () => {
    expect(describeRecurrence('2026-11-16', { type: 'weekly', interval: 2, daysOfWeek: [5, 1] })).toBe('Every 2 weeks on Monday and Friday')
    expect(describeRecurrence('2026-11-16', { type: 'weekly', daysOfWeek: [1, 3, 5] })).toBe('Every week on Monday, Wednesday and Friday')
  })
  it('describes monthly repeats', () => {
    expect(describeRecurrence(START, { type: 'monthly' })).toBe('Every month on the 15th')
    expect(describeRecurrence(START, { type: 'monthly', daysOfMonth: [15, 1] })).toBe('Twice a month, on the 1st and 15th')
    expect(describeRecurrence(START, { type: 'monthly', daysOfMonth: [15, -1] })).toBe('Twice a month, on the 15th and last day')
    expect(describeRecurrence(START, { type: 'monthly', daysOfMonth: [-1] })).toBe('Every month on the last day')
    expect(describeRecurrence(START, { type: 'monthly', interval: 2 })).toBe('Every 2 months on the 15th')
  })
  it('describes monthly on a weekday', () => {
    expect(describeRecurrence('2026-11-10', { type: 'monthlyWeekday' })).toBe('Every month on the second Tuesday')
    expect(describeRecurrence('2026-11-10', { type: 'monthlyWeekday', weekOfMonth: -1, daysOfWeek: [5] })).toBe('Every month on the last Friday')
  })
  it('describes daily, weekday and yearly repeats', () => {
    expect(describeRecurrence(START, { type: 'daily' })).toBe('Every day')
    expect(describeRecurrence(START, { type: 'daily', interval: 3 })).toBe('Every 3 days')
    expect(describeRecurrence(START, { type: 'weekdays' })).toBe('Every weekday (Mon–Fri)')
    expect(describeRecurrence(START, { type: 'yearly' })).toBe('Every year on November 15')
    expect(describeRecurrence(START, { type: 'yearly', interval: 2 })).toBe('Every 2 years on November 15')
  })
  it('adds the end date', () => {
    expect(describeRecurrence(START, { type: 'daily', endDate: '2026-12-31' })).toBe('Every day, until Dec 31, 2026')
  })
  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'])
    expect(ordinal(-1)).toBe('last day')
  })
})
