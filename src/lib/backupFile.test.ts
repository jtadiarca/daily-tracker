import { describe, it, expect } from 'vitest'
import { datasetFromEnvelope, parseBackupText } from './backupFile'

const ISO = '2026-11-15T12:00:00.000Z'
const task = { id: 't1', title: 'Take meds', startDate: '2026-11-15', time: '09:00', recurrence: { type: 'daily' }, reminderOffsetMin: 15, createdAt: ISO, updatedAt: ISO }
const completion = { id: 't1_2026-11-15', taskId: 't1', date: '2026-11-15', completedAt: ISO, updatedAt: ISO }
const envelope = (over: Record<string, unknown> = {}) => ({
  app: 'daily-task-tracker', schemaVersion: 2, exportedAt: ISO, deviceId: 'dev-1',
  data: { tasks: [task], completions: [completion], settings: {} }, ...over,
})
const parse = (o: unknown) => parseBackupText(JSON.stringify(o))
const errorOf = (r: ReturnType<typeof parseBackupText>) => (r.ok ? '' : r.error)

describe('parseBackupText', () => {
  it('accepts a valid backup', () => {
    const r = parse(envelope())
    expect(r.ok).toBe(true)
    if (r.ok) expect(datasetFromEnvelope(r.envelope)).toMatchObject({ tasks: [{ id: 't1' }], completions: [{ id: 't1_2026-11-15' }], settings: [] })
  })
  it('upgrades and accepts a version 1 backup', () => {
    const r = parse(envelope({ schemaVersion: 1 }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.envelope.schemaVersion).toBe(2)
  })
  it('accepts several times a day with per-time completions', () => {
    const multi = { ...task, times: ['08:00', '20:00'], timesFrom: '2026-11-15' }
    const slotted = { ...completion, id: 't1_2026-11-15_08:00', slot: '08:00' }
    const r = parse(envelope({ data: { tasks: [multi], completions: [slotted] } }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.envelope.data.completions[0].slot).toBe('08:00')
  })
  it('accepts a rescheduled time on a repeating task', () => {
    const t = { ...task, recurrence: { type: 'daily', rescheduledDates: ['2026-11-14', '2026-11-15@08:00'] } }
    expect(parse(envelope({ data: { tasks: [t], completions: [] } })).ok).toBe(true)
  })
  it('rejects a single entry in times and a bad time in times', () => {
    expect(parse(envelope({ data: { tasks: [{ ...task, times: ['08:00'] }], completions: [] } })).ok).toBe(false)
    expect(parse(envelope({ data: { tasks: [{ ...task, times: ['08:00', '8pm'] }], completions: [] } })).ok).toBe(false)
  })
  it('rejects a slotted completion whose id does not include the slot', () => {
    const bad = { ...completion, slot: '08:00' }
    expect(errorOf(parse(envelope({ data: { tasks: [], completions: [bad] } })))).toMatch(/completion #1/)
  })
  it('reads real settings when present', () => {
    const settings = { id: 'settings', timeFormat: '12h', defaultReminderOffsetMin: 5, updatedAt: ISO }
    const r = parse(envelope({ data: { tasks: [], completions: [], settings } }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(datasetFromEnvelope(r.envelope).settings).toEqual([settings])
  })
  it('rejects text that is not JSON', () => {
    expect(errorOf(parseBackupText('hello'))).toMatch(/not valid JSON/)
  })
  it('rejects the wrong app', () => {
    expect(errorOf(parse(envelope({ app: 'other-app' })))).toMatch(/different app/)
  })
  it('rejects a missing schema version', () => {
    const { schemaVersion: _drop, ...rest } = envelope()
    expect(errorOf(parse(rest))).toMatch(/schema version/)
  })
  it('rejects a newer schema version', () => {
    expect(errorOf(parse(envelope({ schemaVersion: 3 })))).toMatch(/newer version/)
  })
  it('rejects a task with no title and names it', () => {
    const bad = { ...task, title: undefined }
    expect(errorOf(parse(envelope({ data: { tasks: [bad], completions: [] } })))).toMatch(/task #1/)
  })
  it('rejects a completion whose id does not match its task and date', () => {
    const bad = { ...completion, id: 'wrong' }
    expect(errorOf(parse(envelope({ data: { tasks: [], completions: [bad] } })))).toMatch(/completion #1.*taskId_date/)
  })
  it('rejects badly formatted dates, times and timestamps', () => {
    for (const bad of [{ ...task, startDate: '15/11/2026' }, { ...task, startDate: '2026-02-31' }, { ...task, time: '9am' }, { ...task, updatedAt: 'yesterday' }]) {
      expect(parse(envelope({ data: { tasks: [bad], completions: [] } })).ok).toBe(false)
    }
  })
  it('always says nothing was changed when it rejects', () => {
    expect(errorOf(parse(envelope({ app: 'x' })))).toMatch(/Nothing was changed/)
  })
  it('keeps local dates exactly as written (no timezone shifting)', () => {
    const r = parse(envelope())
    if (r.ok) expect(r.envelope.data.tasks[0].startDate).toBe('2026-11-15')
  })
})
