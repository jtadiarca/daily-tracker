import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getDeviceId } from './db'
import type { Completion, Settings, Task } from './types'
import {
  applyDataset, applyImport, buildEnvelope, clearAllData, clearSnapshot, getLastExportedAt, hasSnapshot,
  previewImport, purgeOldTombstones, readAll, recordExported, undoImport,
} from './backup'
import type { Dataset } from '../lib/merge'

const NOW = new Date(Date.UTC(2026, 10, 15, 13, 0, 0))
const iso = (sec: number) => new Date(Date.UTC(2026, 10, 15, 12, 0, sec)).toISOString()
const task = (id: string, sec: number, o: Partial<Task> = {}): Task => ({
  id, title: id, startDate: '2026-11-15', recurrence: { type: 'none' }, createdAt: iso(0), updatedAt: iso(sec), ...o,
})
const comp = (taskId: string, sec: number, o: Partial<Completion> = {}): Completion => ({
  id: `${taskId}_2026-11-15`, taskId, date: '2026-11-15', completedAt: iso(sec), updatedAt: iso(sec), ...o,
})
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
const norm = (d: Dataset): Dataset => ({
  tasks: [...d.tasks].sort(byId), completions: [...d.completions].sort(byId), settings: [...d.settings].sort(byId),
})
const SETTINGS: Settings = { id: 'settings', timeFormat: '12h', defaultReminderOffsetMin: 15, updatedAt: iso(8) }

const SEED: Dataset = {
  tasks: [
    task('a', 5, { notes: 'note', time: '09:00', reminderOffsetMin: 15, recurrence: { type: 'weekly', daysOfWeek: [1, 3], skipDates: ['2026-11-16'] } }),
    task('b', 6),
    task('gone', 7, { deletedAt: iso(7) }),
  ],
  completions: [comp('a', 3), comp('b', 4, { deletedAt: iso(4) })],
  settings: [SETTINGS],
}

async function seed(d: Dataset) {
  await db.tasks.bulkPut(d.tasks)
  await db.completions.bulkPut(d.completions)
  await db.settings.bulkPut(d.settings)
}

beforeEach(async () => {
  await Promise.all([db.tasks.clear(), db.completions.clear(), db.settings.clear(), db.meta.clear()])
  clearSnapshot()
})

describe('export then import', () => {
  it('into an empty database yields identical data', async () => {
    await seed(SEED)
    const text = JSON.stringify(await buildEnvelope(NOW))
    await Promise.all([db.tasks.clear(), db.completions.clear(), db.settings.clear()])
    const res = await previewImport(text, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    await applyImport(res.preview, 'merge', NOW)
    expect(norm(await readAll())).toEqual(norm(SEED))
  })
  it('includes tombstones and a deviceId, and a second import changes nothing', async () => {
    await seed(SEED)
    const env = await buildEnvelope(NOW)
    expect(env.data.tasks.some(t => t.deletedAt)).toBe(true)
    expect(env.deviceId).toBe(await getDeviceId())
    const res = await previewImport(JSON.stringify(env), NOW)
    if (!res.ok) throw new Error(res.error)
    expect(res.preview.fromOtherDevice).toBe(false)
    const r = await applyImport(res.preview, 'merge', NOW)
    expect(r.summary.added + r.summary.updated).toBe(0)
    expect(norm(await readAll())).toEqual(norm(SEED))
  })
})

describe('rejected files', () => {
  it('change nothing', async () => {
    await seed(SEED)
    const base = JSON.parse(JSON.stringify(await buildEnvelope(NOW)))
    const bad = [
      'not json',
      JSON.stringify({ ...base, app: 'other' }),
      JSON.stringify({ ...base, schemaVersion: 99 }),
      JSON.stringify({ ...base, schemaVersion: undefined }),
      JSON.stringify({ ...base, data: { ...base.data, tasks: [{ id: 'x' }] } }),
    ]
    for (const text of bad) expect((await previewImport(text, NOW)).ok).toBe(false)
    expect(norm(await readAll())).toEqual(norm(SEED))
    expect(hasSnapshot()).toBe(false)
  })
})

describe('atomic import', () => {
  const broken = (): Dataset => ({
    tasks: [task('new', 99)],
    completions: [{ ...comp('new', 99), id: {} as unknown as string }],
    settings: [],
  })
  it('rolls back a failed merge completely', async () => {
    await seed(SEED)
    await expect(applyDataset(broken(), 'merge', NOW)).rejects.toBeTruthy()
    expect(norm(await readAll())).toEqual(norm(SEED))
    expect(hasSnapshot()).toBe(false)
  })
  it('rolls back a failed replace completely, including the clearing step', async () => {
    await seed(SEED)
    await expect(applyDataset(broken(), 'replace', NOW)).rejects.toBeTruthy()
    expect(norm(await readAll())).toEqual(norm(SEED))
  })
})

describe('merge, replace and undo', () => {
  const incoming: Dataset = {
    tasks: [task('a', 50, { title: 'edited elsewhere' }), task('c', 51)],
    completions: [],
    settings: [],
  }
  it('merges, reports what changed, and can be undone', async () => {
    await seed(SEED)
    const r = await applyDataset(incoming, 'merge', NOW)
    expect(r.summary).toMatchObject({ added: 1, updated: 1 })
    const after = await readAll()
    expect(after.tasks.find(t => t.id === 'a')?.title).toBe('edited elsewhere')
    expect(after.tasks.some(t => t.id === 'c')).toBe(true)
    expect(hasSnapshot()).toBe(true)
    expect(await undoImport()).toBe(true)
    expect(norm(await readAll())).toEqual(norm(SEED))
    expect(hasSnapshot()).toBe(false)
  })
  it('replaces everything and can be undone', async () => {
    await seed(SEED)
    await applyDataset(incoming, 'replace', NOW)
    expect((await readAll()).tasks.map(t => t.id).sort()).toEqual(['a', 'c'])
    expect((await readAll()).settings).toHaveLength(0)
    await undoImport()
    expect(norm(await readAll())).toEqual(norm(SEED))
  })
  it('undo does nothing when there is no snapshot', async () => {
    expect(await undoImport()).toBe(false)
  })
})

describe('maintenance', () => {
  it('purges tombstones older than 90 days only', async () => {
    const old = new Date(NOW.getTime() - 100 * 86400000).toISOString()
    const recent = new Date(NOW.getTime() - 10 * 86400000).toISOString()
    await seed({
      tasks: [task('old', 1, { deletedAt: old }), task('recent', 1, { deletedAt: recent }), task('live', 1)],
      completions: [comp('old', 1, { deletedAt: old })],
      settings: [],
    })
    expect(await purgeOldTombstones(NOW)).toBe(2)
    expect((await readAll()).tasks.map(t => t.id).sort()).toEqual(['live', 'recent'])
  })
  it('records the last export time', async () => {
    expect(await getLastExportedAt()).toBeNull()
    await recordExported(NOW)
    expect(await getLastExportedAt()).toBe(NOW.toISOString())
  })
  it('clears all data but keeps the device id', async () => {
    await seed(SEED)
    await recordExported(NOW)
    const id = await getDeviceId()
    await clearAllData()
    expect(await readAll()).toEqual({ tasks: [], completions: [], settings: [] })
    expect(await getLastExportedAt()).toBeNull()
    expect(await getDeviceId()).toBe(id)
  })
})
