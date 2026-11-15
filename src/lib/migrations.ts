export const CURRENT_SCHEMA_VERSION = 1

export type RawEnvelope = Record<string, unknown>
export type MigrationChain = Record<number, (env: RawEnvelope) => RawEnvelope>

// Each entry upgrades a backup from version N to N+1 and must set schemaVersion to N+1.
// When schema 2 ships: bump CURRENT_SCHEMA_VERSION to 2, add `1: (env) => ({ ...env, schemaVersion: 2, data: ... })` here,
// and update the Zod schema in schema.ts to the new shape. Old backups then upgrade step by step.
export const MIGRATIONS: MigrationChain = {}

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
