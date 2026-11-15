import { describe, it, expect } from 'vitest'
import { deriveStatus } from './status'
const at = (day: number, hour: number, minute = 0, second = 0) => new Date(2026, 10, day, hour, minute, second)
describe('status', () => {
  it('prioritizes completion', () => expect(deriveStatus({ date: '2026-11-14', time: '08:00', done: true, now: at(15, 12) })).toBe('done'))
  it('identifies upcoming timed tasks', () => expect(deriveStatus({ date: '2026-11-15', time: '15:00', done: false, now: at(15, 12) })).toBe('upcoming'))
  it('identifies missed timed tasks', () => expect(deriveStatus({ date: '2026-11-15', time: '09:00', done: false, now: at(15, 12) })).toBe('missed'))
  it('becomes missed immediately after its scheduled instant', () => {
    expect(deriveStatus({ date: '2026-11-15', time: '12:00', done: false, now: at(15, 12) })).toBe('upcoming')
    expect(deriveStatus({ date: '2026-11-15', time: '12:00', done: false, now: at(15, 12, 0, 1) })).toBe('missed')
  })
  it('rolls untimed tasks over at local midnight', () => {
    expect(deriveStatus({ date: '2026-11-15', done: false, now: at(15, 23, 59) })).toBe('upcoming')
    expect(deriveStatus({ date: '2026-11-15', done: false, now: at(16, 0) })).toBe('missed')
  })
  it('keeps future dates upcoming', () => expect(deriveStatus({ date: '2026-11-16', time: '00:01', done: false, now: at(15, 23) })).toBe('upcoming'))
})
