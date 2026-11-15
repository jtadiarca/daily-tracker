import { describe, it, expect } from 'vitest'
import { backupsQuery, driveBackupName, driveErrorMessage, driveQuoted, folderQuery, multipartBody } from './drive'

describe('drive helpers', () => {
  it('names backups by local date and time', () => {
    expect(driveBackupName(new Date(2026, 10, 5, 7, 3))).toBe('daily-tracker-backup-2026-11-05-0703.json')
    expect(driveBackupName(new Date(2026, 11, 31, 23, 59))).toBe('daily-tracker-backup-2026-12-31-2359.json')
  })

  it('escapes quotes and backslashes in queries', () => {
    expect(driveQuoted("Bob's")).toBe("'Bob\\'s'")
    expect(driveQuoted('a\\b')).toBe("'a\\\\b'")
  })

  it('builds the folder and backup queries', () => {
    expect(folderQuery()).toBe("name = 'Daily Tracker backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
    expect(backupsQuery('abc')).toBe("'abc' in parents and trashed = false and mimeType = 'application/json'")
  })

  it('builds a multipart body with metadata first and a closing boundary', () => {
    const body = multipartBody({ name: 'x.json', parents: ['f'] }, '{"a":1}', 'BOUND')
    const parts = body.split('\r\n')
    expect(parts[0]).toBe('--BOUND')
    expect(JSON.parse(parts[3])).toEqual({ name: 'x.json', parents: ['f'] })
    expect(parts[7]).toBe('{"a":1}')
    expect(body.endsWith('--BOUND--\r\n')).toBe(true)
  })

  it('explains common errors', () => {
    expect(driveErrorMessage(401)).toMatch(/expired/)
    expect(driveErrorMessage(403, { error: { message: 'Drive API is disabled' } })).toMatch(/Drive API is disabled/)
    expect(driveErrorMessage(503)).toMatch(/problems/)
  })
})
