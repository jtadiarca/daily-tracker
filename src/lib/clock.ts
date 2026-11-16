// Helpers for the Material 3 time picker. Times are 'HH:mm' strings (24-hour), as everywhere else in the app.

export type HourMinute = { h: number; m: number }

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** 'HH:mm' to hours and minutes. Anything that isn't a valid time gives null. */
export function splitTime(hhmm: string): HourMinute | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  return h < 24 && min < 60 ? { h, m: min } : null
}

export const joinTime = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`

/** 24-hour hour to the 12-hour clock: 0 -> 12 AM, 13 -> 1 PM. */
export const to12 = (h: number) => ({ hour: h % 12 || 12, pm: h >= 12 })

/** 12-hour clock to a 24-hour hour: 12 AM -> 0, 12 PM -> 12, 1 PM -> 13. */
export const from12 = (hour: number, pm: boolean) => (hour % 12) + (pm ? 12 : 0)

/**
 * The hour numbers on the dial, as [value, ring] in clockwise order from 12 o'clock.
 * 12-hour: one ring, 12 then 1 to 11. 24-hour: outer ring 12 then 1 to 11, inner ring 00 then 13 to 23.
 */
export function hourMarks(is24: boolean): Array<{ value: number; inner: boolean; label: string }> {
  const outer = Array.from({ length: 12 }, (_, i) => ({ value: i === 0 ? 12 : i, inner: false, label: String(i === 0 ? 12 : i) }))
  if (!is24) return outer
  const inner = Array.from({ length: 12 }, (_, i) => ({ value: i === 0 ? 0 : i + 12, inner: true, label: i === 0 ? '00' : String(i + 12) }))
  return [...outer, ...inner]
}

/** Minute labels on the dial: every 5 minutes, clockwise from 12 o'clock. */
export const MINUTE_MARKS = Array.from({ length: 12 }, (_, i) => i * 5)

/** Angle in degrees, clockwise from 12 o'clock, of a point (dx, dy) from the dial center (y grows downward). */
export function angleOf(dx: number, dy: number): number {
  const a = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (a + 360) % 360
}

/**
 * The hour picked by touching the dial at an angle. pm and inner only matter where they apply:
 * pm keeps the AM/PM half on a 12-hour clock, inner picks the inner ring on a 24-hour clock.
 */
export function hourAtAngle(angle: number, is24: boolean, inner: boolean, pm: boolean): number {
  const step = Math.round(angle / 30) % 12 // 0 = 12 o'clock
  if (is24) return inner ? (step === 0 ? 0 : step + 12) : step === 0 ? 12 : step
  return from12(step === 0 ? 12 : step, pm)
}

/** The minute picked by touching the dial at an angle. snap rounds to the nearest 5 (used for taps, not drags). */
export function minuteAtAngle(angle: number, snap = false): number {
  const m = Math.round(angle / 6) % 60
  return snap ? (Math.round(m / 5) * 5) % 60 : m
}

/** Where the dial's hand points (degrees) and whether it reaches the inner ring, for an hour or minute. */
export function handFor(mode: 'hour' | 'minute', value: number, is24: boolean): { angle: number; inner: boolean } {
  if (mode === 'minute') return { angle: value * 6, inner: false }
  return { angle: (value % 12) * 30, inner: is24 && (value === 0 || value > 12) }
}

/** Reads what was typed in the hour box. 12-hour clock: 1-12; 24-hour: 0-23. Null when not valid. */
export function parseHourInput(text: string, is24: boolean): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const n = Number(text)
  return is24 ? (n <= 23 ? n : null) : n >= 1 && n <= 12 ? n : null
}

/** Reads what was typed in the minute box: 0-59. Null when not valid. */
export function parseMinuteInput(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const n = Number(text)
  return n <= 59 ? n : null
}
