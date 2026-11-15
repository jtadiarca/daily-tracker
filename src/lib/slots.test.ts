import { describe, it, expect } from 'vitest'
import { completionSlot, doneKey, isMultiSlot, isSlotDone, rescheduleKey, slotsOf } from './slots'

const single = { id: 't', time: '09:00' }
const untimed = { id: 'u' }
const multi = { id: 'm', time: '08:00', times: ['20:00', '08:00', '14:00'] }

describe('slotsOf', () => {
  it('returns one slot for single-time and untimed tasks', () => {
    expect(slotsOf(single, '2026-11-15')).toEqual(['09:00'])
    expect(slotsOf(untimed, '2026-11-15')).toEqual([null])
  })
  it('returns sorted, unique times for multi-time tasks', () => {
    expect(slotsOf({ ...multi, times: ['20:00', '08:00', '08:00'] }, '2026-11-15')).toEqual(['08:00', '20:00'])
  })
  it('ignores a times list with fewer than two entries', () => {
    expect(slotsOf({ id: 'x', time: '07:00', times: ['10:00'] }, '2026-11-15')).toEqual(['07:00'])
  })
  it('uses the single time before timesFrom and the list from that date on', () => {
    const t = { ...multi, timesFrom: '2026-11-15' }
    expect(slotsOf(t, '2026-11-14')).toEqual(['08:00'])
    expect(slotsOf(t, '2026-11-15')).toEqual(['08:00', '14:00', '20:00'])
  })
})

describe('completion keys', () => {
  it('keeps the old id for single-time and untimed tasks, even if a slot is passed', () => {
    expect(doneKey(single, '2026-11-15', '09:00')).toBe('t_2026-11-15')
    expect(doneKey(untimed, '2026-11-15', null)).toBe('u_2026-11-15')
  })
  it('adds the time for multi-time tasks', () => {
    expect(doneKey(multi, '2026-11-15', '14:00')).toBe('m_2026-11-15_14:00')
    expect(completionSlot(multi, '2026-11-15', '14:00')).toBe('14:00')
    expect(isMultiSlot(multi, '2026-11-15')).toBe(true)
  })
  it('checks each time separately', () => {
    const done = new Set(['m_2026-11-15_08:00'])
    expect(isSlotDone(done, multi, '2026-11-15', '08:00')).toBe(true)
    expect(isSlotDone(done, multi, '2026-11-15', '20:00')).toBe(false)
  })
  it('builds reschedule keys with the time only for multi-time tasks', () => {
    expect(rescheduleKey(single, '2026-11-15', '09:00')).toBe('2026-11-15')
    expect(rescheduleKey(multi, '2026-11-15', '14:00')).toBe('2026-11-15@14:00')
  })
})
