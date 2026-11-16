import { describe, expect, it } from 'vitest'
import {
  angleOf, from12, handFor, hourAtAngle, hourMarks, joinTime, minuteAtAngle, parseHourInput, parseMinuteInput, splitTime, to12,
} from './clock'

describe('time strings', () => {
  it('splits and joins', () => {
    expect(splitTime('09:05')).toEqual({ h: 9, m: 5 })
    expect(splitTime('24:00')).toBeNull()
    expect(splitTime('')).toBeNull()
    expect(joinTime(7, 3)).toBe('07:03')
  })
  it('converts between 12- and 24-hour clocks', () => {
    expect(to12(0)).toEqual({ hour: 12, pm: false })
    expect(to12(12)).toEqual({ hour: 12, pm: true })
    expect(to12(15)).toEqual({ hour: 3, pm: true })
    expect(from12(12, false)).toBe(0)
    expect(from12(12, true)).toBe(12)
    expect(from12(3, true)).toBe(15)
  })
})

describe('dial', () => {
  it('lays out hour marks', () => {
    expect(hourMarks(false).map(m => m.value)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const h24 = hourMarks(true)
    expect(h24).toHaveLength(24)
    expect(h24[12]).toEqual({ value: 0, inner: true, label: '00' })
    expect(h24[13].value).toBe(13)
  })
  it('measures angles clockwise from 12 o’clock', () => {
    expect(angleOf(0, -10)).toBe(0)
    expect(angleOf(10, 0)).toBe(90)
    expect(angleOf(0, 10)).toBe(180)
    expect(angleOf(-10, 0)).toBe(270)
  })
  it('reads hours from angles', () => {
    expect(hourAtAngle(0, false, false, false)).toBe(0) // 12 AM
    expect(hourAtAngle(0, false, false, true)).toBe(12) // 12 PM
    expect(hourAtAngle(90, false, false, true)).toBe(15)
    expect(hourAtAngle(350, false, false, false)).toBe(0)
    expect(hourAtAngle(90, true, false, false)).toBe(3)
    expect(hourAtAngle(90, true, true, false)).toBe(15)
    expect(hourAtAngle(0, true, true, false)).toBe(0)
    expect(hourAtAngle(0, true, false, false)).toBe(12)
  })
  it('reads minutes from angles', () => {
    expect(minuteAtAngle(90)).toBe(15)
    expect(minuteAtAngle(100)).toBe(17)
    expect(minuteAtAngle(100, true)).toBe(15)
    expect(minuteAtAngle(358)).toBe(0)
    expect(minuteAtAngle(358, true)).toBe(0)
  })
  it('points the hand', () => {
    expect(handFor('minute', 30, false)).toEqual({ angle: 180, inner: false })
    expect(handFor('hour', 15, false)).toEqual({ angle: 90, inner: false })
    expect(handFor('hour', 15, true)).toEqual({ angle: 90, inner: true })
    expect(handFor('hour', 0, true)).toEqual({ angle: 0, inner: true })
    expect(handFor('hour', 12, true)).toEqual({ angle: 0, inner: false })
  })
})

describe('typed input', () => {
  it('checks hours for each clock', () => {
    expect(parseHourInput('12', false)).toBe(12)
    expect(parseHourInput('0', false)).toBeNull()
    expect(parseHourInput('13', false)).toBeNull()
    expect(parseHourInput('0', true)).toBe(0)
    expect(parseHourInput('23', true)).toBe(23)
    expect(parseHourInput('24', true)).toBeNull()
    expect(parseHourInput('x', true)).toBeNull()
  })
  it('checks minutes', () => {
    expect(parseMinuteInput('07')).toBe(7)
    expect(parseMinuteInput('60')).toBeNull()
    expect(parseMinuteInput('')).toBeNull()
  })
})
