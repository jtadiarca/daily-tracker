import { describe, it, expect, afterEach } from 'vitest'
import { formatTime, setTimeFormat } from './time'

afterEach(() => setTimeFormat('12h'))

describe('formatTime', () => {
  it('defaults to 12-hour', () => {
    expect(formatTime('15:00')).toBe('3:00 PM')
  })
  it('returns 24-hour times unchanged', () => {
    expect(formatTime('09:05', '24h')).toBe('09:05')
  })
  it('converts to 12-hour times', () => {
    expect(formatTime('00:05', '12h')).toBe('12:05 AM')
    expect(formatTime('09:00', '12h')).toBe('9:00 AM')
    expect(formatTime('12:00', '12h')).toBe('12:00 PM')
    expect(formatTime('13:30', '12h')).toBe('1:30 PM')
    expect(formatTime('23:59', '12h')).toBe('11:59 PM')
  })
  it('uses the configured default format', () => {
    setTimeFormat('24h')
    expect(formatTime('15:00')).toBe('15:00')
  })
})
