import { describe, it, expect } from 'vitest'
import { migrateEnvelope, type MigrationChain } from './migrations'

// A v1 -> v2 stub: pretend schema 2 adds a `tags` list to the data.
const v1ToV2: MigrationChain = {
  1: env => ({ ...env, schemaVersion: 2, data: { ...(env.data as object), tags: [] } }),
}

describe('migrateEnvelope', () => {
  it('upgrades v1 to v2 with the stub migration', () => {
    const out = migrateEnvelope({ app: 'x', schemaVersion: 1, data: { tasks: [] } }, v1ToV2, 2)
    expect(out.schemaVersion).toBe(2)
    expect((out.data as { tags: unknown[] }).tags).toEqual([])
    expect((out.data as { tasks: unknown[] }).tasks).toEqual([])
  })
  it('walks a multi-step chain', () => {
    const chain: MigrationChain = { ...v1ToV2, 2: env => ({ ...env, schemaVersion: 3, migratedTwice: true }) }
    const out = migrateEnvelope({ schemaVersion: 1, data: {} }, chain, 3)
    expect(out.schemaVersion).toBe(3)
    expect(out.migratedTwice).toBe(true)
  })
  it('leaves a current-version backup alone', () => {
    const env = { schemaVersion: 1, data: {} }
    expect(migrateEnvelope(env, {}, 1)).toBe(env)
  })
  it('rejects a newer version', () => {
    expect(() => migrateEnvelope({ schemaVersion: 3, data: {} }, v1ToV2, 2)).toThrow(/newer/)
  })
  it('rejects a missing step and a missing version', () => {
    expect(() => migrateEnvelope({ schemaVersion: 1, data: {} }, {}, 2)).toThrow(/no migration/i)
    expect(() => migrateEnvelope({ data: {} }, v1ToV2, 2)).toThrow(/schema version/)
  })
  it('rejects a migration that does not advance the version', () => {
    expect(() => migrateEnvelope({ schemaVersion: 1, data: {} }, { 1: env => env }, 2)).toThrow(/did not produce/)
  })
})
