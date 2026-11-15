import { describe, it, expect } from 'vitest'
import type { Completion, Settings, Task } from '../db/types'
import { mergeDatasets, purgeTombstones, skippedCount, unchangedCount, type Dataset } from './merge'

const NOW = new Date(Date.UTC(2026, 10, 15, 13, 0, 0))
const iso = (sec: number) => new Date(Date.UTC(2026, 10, 15, 12, 0, sec)).toISOString()
const task = (id: string, sec: number, o: Partial<Task> = {}): Task => ({
  id, title: id, startDate: '2026-11-15', recurrence: { type: 'none' }, createdAt: iso(0), updatedAt: iso(sec), ...o,
})
const comp = (taskId: string, sec: number, o: Partial<Completion> = {}): Completion => ({
  id: `${taskId}_2026-11-15`, taskId, date: '2026-11-15', completedAt: iso(sec), updatedAt: iso(sec), ...o,
})
const settings = (sec: number, o: Partial<Settings> = {}): Settings => ({
  id: 'settings', timeFormat: '24h', defaultReminderOffsetMin: null, updatedAt: iso(sec), ...o,
})
const ds = (p: Partial<Dataset>): Dataset => ({ tasks: [], completions: [], settings: [], ...p })
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
const norm = (d: Dataset): Dataset => ({
  tasks: [...d.tasks].sort(byId), completions: [...d.completions].sort(byId), settings: [...d.settings].sort(byId),
})

describe('last write wins', () => {
  it('keeps the newer edit', () => {
    const r = mergeDatasets(ds({ tasks: [task('a', 5, { title: 'old' })] }), ds({ tasks: [task('a', 9, { title: 'new' })] }), NOW)
    expect(r.merged.tasks[0].title).toBe('new')
    expect(r.summary.updated).toBe(1)
  })
  it('ignores an older incoming edit', () => {
    const r = mergeDatasets(ds({ tasks: [task('a', 9, { title: 'mine' })] }), ds({ tasks: [task('a', 5, { title: 'theirs' })] }), NOW)
    expect(r.merged.tasks[0].title).toBe('mine')
    expect(r.summary.keptLocalNewer).toBe(1)
    expect(r.changes.tasks).toHaveLength(0)
  })
  it('a tombstone wins over an older edit', () => {
    const r = mergeDatasets(ds({ tasks: [task('a', 5)] }), ds({ tasks: [task('a', 9, { deletedAt: iso(9) })] }), NOW)
    expect(r.merged.tasks[0].deletedAt).toBeDefined()
  })
  it('a tombstone loses to a newer edit', () => {
    const r = mergeDatasets(ds({ tasks: [task('a', 5, { deletedAt: iso(5) })] }), ds({ tasks: [task('a', 9, { title: 'revived' })] }), NOW)
    expect(r.merged.tasks[0].deletedAt).toBeUndefined()
    expect(r.merged.tasks[0].title).toBe('revived')
  })
  it('on equal timestamps prefers the record that is not deleted, from either side', () => {
    const live = task('a', 7)
    const dead = task('a', 7, { deletedAt: iso(7) })
    expect(mergeDatasets(ds({ tasks: [dead] }), ds({ tasks: [live] }), NOW).merged.tasks[0].deletedAt).toBeUndefined()
    expect(mergeDatasets(ds({ tasks: [live] }), ds({ tasks: [dead] }), NOW).merged.tasks[0].deletedAt).toBeUndefined()
  })
  it('breaks other ties the same way from either side', () => {
    const x = task('a', 7, { title: 'x' })
    const y = task('a', 7, { title: 'y' })
    expect(mergeDatasets(ds({ tasks: [x] }), ds({ tasks: [y] }), NOW).merged).toEqual(mergeDatasets(ds({ tasks: [y] }), ds({ tasks: [x] }), NOW).merged)
  })
  it('handles completions and settings the same way', () => {
    const r = mergeDatasets(
      ds({ completions: [comp('a', 3)], settings: [settings(7)] }),
      ds({ completions: [comp('a', 4, { deletedAt: iso(4) })], settings: [settings(9, { timeFormat: '12h' })] }), NOW)
    expect(r.merged.completions[0].deletedAt).toBeDefined()
    expect(r.merged.settings[0].timeFormat).toBe('12h')
  })
})

describe('union', () => {
  it('keeps records that exist on only one side', () => {
    const r = mergeDatasets(ds({ tasks: [task('a', 1)] }), ds({ tasks: [task('b', 1)] }), NOW)
    expect(r.merged.tasks.map(t => t.id).sort()).toEqual(['a', 'b'])
    expect(r.summary.added).toBe(1)
  })
})

describe('idempotent and commutative', () => {
  const A = ds({
    tasks: [task('t1', 10, { title: 'A1' }), task('t2', 5), task('t3', 2)],
    completions: [comp('t1', 3), comp('t2', 20, { deletedAt: iso(20) })],
    settings: [settings(7)],
  })
  const B = ds({
    tasks: [task('t1', 12, { title: 'B1' }), task('t2', 6, { deletedAt: iso(6) }), task('t4', 1)],
    completions: [comp('t1', 4, { deletedAt: iso(4) }), comp('t2', 19)],
    settings: [settings(9, { timeFormat: '12h' })],
  })
  it('importing the same file twice changes nothing', () => {
    const once = mergeDatasets(A, B, NOW)
    const twice = mergeDatasets(once.merged, B, NOW)
    expect(twice.changes).toEqual({ tasks: [], completions: [], settings: [] })
    expect(norm(twice.merged)).toEqual(norm(once.merged))
  })
  it('A into B and B into A converge to the same data', () => {
    expect(norm(mergeDatasets(A, B, NOW).merged)).toEqual(norm(mergeDatasets(B, A, NOW).merged))
  })
  it('picks the expected winners', () => {
    const m = norm(mergeDatasets(A, B, NOW).merged)
    expect(m.tasks.find(t => t.id === 't1')?.title).toBe('B1')
    expect(m.tasks.find(t => t.id === 't2')?.deletedAt).toBeDefined()
    expect(m.completions.find(c => c.taskId === 't1')?.deletedAt).toBeDefined()
    expect(m.completions.find(c => c.taskId === 't2')?.deletedAt).toBeDefined()
    expect(m.settings[0].timeFormat).toBe('12h')
  })
})

describe('clock skew guard', () => {
  it('ignores records more than 24 hours in the future and reports them', () => {
    const future = task('f', 0, { updatedAt: new Date(NOW.getTime() + 25 * 3600 * 1000).toISOString() })
    const r = mergeDatasets(ds({}), ds({ tasks: [future] }), NOW)
    expect(r.merged.tasks).toHaveLength(0)
    expect(r.summary.skippedFuture).toBe(1)
  })
  it('accepts records up to 24 hours ahead', () => {
    const ok = task('f', 0, { updatedAt: new Date(NOW.getTime() + 23 * 3600 * 1000).toISOString() })
    expect(mergeDatasets(ds({}), ds({ tasks: [ok] }), NOW).merged.tasks).toHaveLength(1)
  })
})

describe('summary', () => {
  it('counts added, updated, identical and kept records', () => {
    const local = ds({ tasks: [task('a', 5), task('b', 5), task('c', 9)] })
    const incoming = ds({ tasks: [task('a', 5), task('b', 8, { title: 'changed' }), task('c', 3, { title: 'older' }), task('d', 1)] })
    const s = mergeDatasets(local, incoming, NOW).summary
    expect(s).toEqual({ added: 1, updated: 1, identical: 1, keptLocalNewer: 1, skippedFuture: 0 })
    expect(unchangedCount(s)).toBe(2)
    expect(skippedCount(s)).toBe(2)
  })
})

describe('purgeTombstones', () => {
  it('removes tombstones older than 90 days only', () => {
    const old = new Date(NOW.getTime() - 91 * 86400000).toISOString()
    const recent = new Date(NOW.getTime() - 89 * 86400000).toISOString()
    const d = ds({
      tasks: [task('old', 1, { deletedAt: old }), task('recent', 1, { deletedAt: recent }), task('live', 1)],
      completions: [comp('old', 1, { deletedAt: old })],
    })
    const out = purgeTombstones(d, NOW)
    expect(out.tasks.map(t => t.id).sort()).toEqual(['live', 'recent'])
    expect(out.completions).toHaveLength(0)
  })
})
