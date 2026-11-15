import { db, getDeviceId } from './db'
import type { Settings } from './types'
import { APP_ID } from '../lib/schema'
import { CURRENT_SCHEMA_VERSION } from '../lib/migrations'
import { datasetFromEnvelope, parseBackupText } from '../lib/backupFile'
import { mergeDatasets, TOMBSTONE_TTL_MS, type Dataset, type MergeSummary } from '../lib/merge'

export type ImportMode = 'merge' | 'replace'

export interface BackupEnvelope {
  app: string
  schemaVersion: number
  exportedAt: string
  deviceId: string
  data: { tasks: Dataset['tasks']; completions: Dataset['completions']; settings: Settings | Record<string, never> }
}

export interface ImportPreview {
  incoming: Dataset
  exportedAt: string
  fromOtherDevice: boolean
  counts: { tasks: number; completions: number; deletions: number }
  merge: MergeSummary
  replace: { removingTasks: number; removingCompletions: number }
}
export type PreviewResult = { ok: true; preview: ImportPreview } | { ok: false; error: string }

export interface ImportResult { mode: ImportMode; summary: MergeSummary; loaded: { tasks: number; completions: number }; removed: number }

export async function readAll(): Promise<Dataset> {
  const [tasks, completions, settings] = await Promise.all([db.tasks.toArray(), db.completions.toArray(), db.settings.toArray()])
  return { tasks, completions, settings }
}

async function writeDataset(d: Dataset) {
  await db.tasks.bulkPut(d.tasks)
  await db.completions.bulkPut(d.completions)
  await db.settings.bulkPut(d.settings)
}

export async function buildEnvelope(now = new Date()): Promise<BackupEnvelope> {
  const data = await readAll()
  return {
    app: APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    deviceId: await getDeviceId(),
    data: { tasks: data.tasks, completions: data.completions, settings: data.settings[0] ?? {} },
  }
}

export async function getLastExportedAt(): Promise<string | null> {
  const row = await db.meta.get('lastExportedAt')
  return (row?.value as string | undefined) ?? null
}

export async function recordExported(now = new Date()) {
  await db.meta.put({ key: 'lastExportedAt', value: now.toISOString() })
}

// ---- Import ----

const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter(r => !r.deletedAt).length
const dead = <T extends { deletedAt?: string }>(rows: T[]) => rows.length - live(rows)

// Validates the file and works out what an import would do. Never writes to the database.
export async function previewImport(text: string, now = new Date()): Promise<PreviewResult> {
  const parsed = parseBackupText(text)
  if (!parsed.ok) return parsed
  const env = parsed.envelope
  const incoming = datasetFromEnvelope(env)
  const local = await readAll()
  return {
    ok: true,
    preview: {
      incoming,
      exportedAt: env.exportedAt,
      fromOtherDevice: env.deviceId !== (await getDeviceId()),
      counts: {
        tasks: live(incoming.tasks),
        completions: live(incoming.completions),
        deletions: dead(incoming.tasks) + dead(incoming.completions),
      },
      merge: mergeDatasets(local, incoming, now).summary,
      replace: { removingTasks: live(local.tasks), removingCompletions: live(local.completions) },
    },
  }
}

// The snapshot lives in memory only, so Undo import works until the app is next launched or reloaded.
let snapshot: Dataset | null = null
export const hasSnapshot = () => snapshot !== null
export const clearSnapshot = () => { snapshot = null }

// Applies an already validated dataset in ONE transaction. If any write fails, everything rolls back.
export async function applyDataset(incoming: Dataset, mode: ImportMode, now = new Date()): Promise<ImportResult> {
  const out = await db.transaction('rw', db.tasks, db.completions, db.settings, async () => {
    const before = await readAll()
    if (mode === 'merge') {
      const r = mergeDatasets(before, incoming, now)
      await writeDataset(r.changes)
      return { before, summary: r.summary, removed: 0 }
    }
    await Promise.all([db.tasks.clear(), db.completions.clear(), db.settings.clear()])
    await writeDataset(incoming)
    const total = incoming.tasks.length + incoming.completions.length + incoming.settings.length
    return {
      before,
      summary: { added: total, updated: 0, identical: 0, keptLocalNewer: 0, skippedFuture: 0 },
      removed: before.tasks.length + before.completions.length + before.settings.length,
    }
  })
  snapshot = out.before
  return {
    mode,
    summary: out.summary,
    loaded: { tasks: live(incoming.tasks), completions: live(incoming.completions) },
    removed: out.removed,
  }
}

export const applyImport = (preview: ImportPreview, mode: ImportMode, now = new Date()) => applyDataset(preview.incoming, mode, now)

export async function undoImport(): Promise<boolean> {
  const snap = snapshot
  if (!snap) return false
  await db.transaction('rw', db.tasks, db.completions, db.settings, async () => {
    await Promise.all([db.tasks.clear(), db.completions.clear(), db.settings.clear()])
    await writeDataset(snap)
  })
  snapshot = null
  return true
}

// ---- Maintenance ----

export async function purgeOldTombstones(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TOMBSTONE_TTL_MS).toISOString()
  return db.transaction('rw', db.tasks, db.completions, async () => {
    const t = await db.tasks.where('deletedAt').below(cutoff).primaryKeys()
    const c = await db.completions.where('deletedAt').below(cutoff).primaryKeys()
    await db.tasks.bulkDelete(t)
    await db.completions.bulkDelete(c)
    return t.length + c.length
  })
}

// Removes all tasks, completions and settings. The device id stays so this device keeps its identity.
export async function clearAllData() {
  await db.transaction('rw', db.tasks, db.completions, db.settings, db.meta, async () => {
    await Promise.all([db.tasks.clear(), db.completions.clear(), db.settings.clear()])
    await db.meta.delete('lastExportedAt')
  })
  snapshot = null
  if (typeof localStorage !== 'undefined') localStorage.removeItem('dtt.firedReminders')
}
