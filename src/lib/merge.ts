import type { Completion, Settings, Task } from '../db/types'

export interface Dataset { tasks: Task[]; completions: Completion[]; settings: Settings[] }
export interface MergeSummary { added: number; updated: number; identical: number; keptLocalNewer: number; skippedFuture: number }
export interface MergeResult { merged: Dataset; changes: Dataset; summary: MergeSummary }

type Rec = { id: string; updatedAt: string; deletedAt?: string }

export const SKEW_MS = 24 * 60 * 60 * 1000
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export const emptyDataset = (): Dataset => ({ tasks: [], completions: [], settings: [] })

export function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val)
}

// Last write wins by updatedAt. On a tie the record that is not deleted wins; if both are alike,
// a fixed content order decides, so the result never depends on which side is "local".
export function pickWinner<T extends Rec>(a: T, b: T): T {
  const ta = Date.parse(a.updatedAt)
  const tb = Date.parse(b.updatedAt)
  if (ta !== tb) return ta > tb ? a : b
  const da = !!a.deletedAt
  const db = !!b.deletedAt
  if (da !== db) return da ? b : a
  return stableStringify(a) >= stableStringify(b) ? a : b
}

function mergeCollection<T extends Rec>(local: T[], incoming: T[], nowMs: number) {
  const byId = new Map<string, T>(local.map(r => [r.id, r]))
  const changes: T[] = []
  const s: MergeSummary = { added: 0, updated: 0, identical: 0, keptLocalNewer: 0, skippedFuture: 0 }
  for (const inc of incoming) {
    if (Date.parse(inc.updatedAt) > nowMs + SKEW_MS) { s.skippedFuture++; continue }
    const cur = byId.get(inc.id)
    if (!cur) { byId.set(inc.id, inc); changes.push(inc); s.added++; continue }
    if (stableStringify(cur) === stableStringify(inc)) { s.identical++; continue }
    if (pickWinner(cur, inc) === inc) { byId.set(inc.id, inc); changes.push(inc); s.updated++ } else s.keptLocalNewer++
  }
  return { merged: [...byId.values()], changes, s }
}

export function mergeDatasets(local: Dataset, incoming: Dataset, now: Date): MergeResult {
  const nowMs = now.getTime()
  const t = mergeCollection(local.tasks, incoming.tasks, nowMs)
  const c = mergeCollection(local.completions, incoming.completions, nowMs)
  const s = mergeCollection(local.settings, incoming.settings, nowMs)
  const sum = (k: keyof MergeSummary) => t.s[k] + c.s[k] + s.s[k]
  return {
    merged: { tasks: t.merged, completions: c.merged, settings: s.merged },
    changes: { tasks: t.changes, completions: c.changes, settings: s.changes },
    summary: { added: sum('added'), updated: sum('updated'), identical: sum('identical'), keptLocalNewer: sum('keptLocalNewer'), skippedFuture: sum('skippedFuture') },
  }
}

export const unchangedCount = (s: MergeSummary) => s.identical + s.keptLocalNewer
export const skippedCount = (s: MergeSummary) => unchangedCount(s) + s.skippedFuture

export function isOldTombstone(r: Rec, now: Date): boolean {
  return !!r.deletedAt && Date.parse(r.deletedAt) < now.getTime() - TOMBSTONE_TTL_MS
}

// Hard-purges tombstones older than 90 days. A device that was offline longer than that and still holds a
// live copy of a purged record can bring it back on the next import, so export from every device regularly.
export function purgeTombstones(d: Dataset, now: Date): Dataset {
  return {
    tasks: d.tasks.filter(r => !isOldTombstone(r, now)),
    completions: d.completions.filter(r => !isOldTombstone(r, now)),
    settings: d.settings,
  }
}
