export const CURRENT_SCHEMA_VERSION = 3

export type RawEnvelope = Record<string, unknown>
export type MigrationChain = Record<number, (env: RawEnvelope) => RawEnvelope>

// Each entry upgrades a backup from version N to N+1 and must set schemaVersion to N+1.
// To add version 4: bump CURRENT_SCHEMA_VERSION, add a `3: (env) => ...` step here, and update schema.ts.
export const MIGRATIONS: MigrationChain = {
  // v1 -> v2: version 2 adds several times a day (task.times, task.timesFrom) and per-time completions
  // (completion.slot). Everything is optional, so a version 1 backup is valid as it is.
  1: env => ({ ...env, schemaVersion: 2 }),
  // v2 -> v3: version 3 adds more repeat options (recurrence.interval, daysOfMonth, weekOfMonth and the
  // monthly, monthlyWeekday and yearly types). All new fields are optional, so nothing needs to change.
  2: env => ({ ...env, schemaVersion: 3 }),
}

export function migrateEnvelope(env: RawEnvelope, chain: MigrationChain = MIGRATIONS, target: number = CURRENT_SCHEMA_VERSION): RawEnvelope {
  let cur = env
  let v = Number(cur.schemaVersion)
  if (!Number.isInteger(v) || v < 1) throw new Error('The backup has a missing or invalid schema version.')
  if (v > target) throw new Error(`The backup uses schema version ${v}, which is newer than this app supports (${target}).`)
  while (v < target) {
    const step = chain[v]
    if (!step) throw new Error(`There is no migration from schema version ${v}.`)
    cur = step(cur)
    const next = Number(cur.schemaVersion)
    if (next !== v + 1) throw new Error(`The migration from version ${v} did not produce version ${v + 1}.`)
    v = next
  }
  return cur
}
