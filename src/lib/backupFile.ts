import type { ZodIssue } from 'zod'
import type { Settings } from '../db/types'
import { APP_ID, EnvelopeSchema, type Envelope } from './schema'
import { CURRENT_SCHEMA_VERSION, migrateEnvelope, type RawEnvelope } from './migrations'
import type { Dataset } from './merge'

export type ParseResult = { ok: true; envelope: Envelope } | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error: `${error} Nothing was changed.` })

function describeIssue(i: ZodIssue): string {
  const p = i.path
  if (p[0] === 'data' && typeof p[2] === 'number') {
    const kind = p[1] === 'tasks' ? 'task' : p[1] === 'completions' ? 'completion' : String(p[1])
    const field = p.length > 3 ? ` (${p.slice(3).join('.')})` : ''
    return `${kind} #${p[2] + 1}${field}: ${i.message}`
  }
  return `${p.join('.') || 'file'}: ${i.message}`
}

// Validates a backup file's text without touching the database.
export function parseBackupText(text: string): ParseResult {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return fail('This file is not valid JSON, so it is not a backup from this app.') }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('This file does not look like a backup from this app.')
  const obj = raw as RawEnvelope
  if (obj.app !== APP_ID) {
    return fail(`This backup belongs to a different app (${typeof obj.app === 'string' ? `"${obj.app}"` : 'no app name found'}).`)
  }
  const v = obj.schemaVersion
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return fail('The backup is missing a valid schema version.')
  if (v > CURRENT_SCHEMA_VERSION) {
    return fail(`This backup was made by a newer version of the app (schema version ${v}). Update the app on this device first.`)
  }
  let migrated: RawEnvelope
  try { migrated = migrateEnvelope(obj) } catch (e) { return fail(e instanceof Error ? e.message : 'The backup could not be upgraded.') }
  const parsed = EnvelopeSchema.safeParse(migrated)
  if (!parsed.success) {
    const issues = parsed.error.issues
    const shown = issues.slice(0, 3).map(describeIssue).join('; ')
    const more = issues.length > 3 ? ` (and ${issues.length - 3} more problems)` : ''
    return fail(`The backup file is damaged or invalid: ${shown}${more}.`)
  }
  return { ok: true, envelope: parsed.data }
}

export function datasetFromEnvelope(env: Envelope): Dataset {
  const s = env.data.settings
  return {
    tasks: env.data.tasks,
    completions: env.data.completions,
    settings: s && 'id' in s ? [s as Settings] : [],
  }
}
