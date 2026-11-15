import { describe, it, expect } from 'vitest'
import { exportReminderDue } from './exportReminder'

const now = new Date('2026-11-15T12:00:00.000Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString()

describe('exportReminderDue', () => {
  it('is false when there is no data', () => {
    expect(exportReminderDue({ lastExportedAt: null, earliestCreatedAt: daysAgo(60), hasData: false, now })).toBe(false)
  })
  it('is false within 14 days of the last export and true after', () => {
    expect(exportReminderDue({ lastExportedAt: daysAgo(13), earliestCreatedAt: daysAgo(60), hasData: true, now })).toBe(false)
    expect(exportReminderDue({ lastExportedAt: daysAgo(15), earliestCreatedAt: daysAgo(60), hasData: true, now })).toBe(true)
  })
  it('counts from the oldest record when nothing was ever exported', () => {
    expect(exportReminderDue({ lastExportedAt: null, earliestCreatedAt: daysAgo(3), hasData: true, now })).toBe(false)
    expect(exportReminderDue({ lastExportedAt: null, earliestCreatedAt: daysAgo(20), hasData: true, now })).toBe(true)
  })
})
