import { db } from './db'
import type { Settings } from './types'
import { nowIso } from '../lib/dates'

// Used when nothing is stored yet. The old timestamp means any real saved settings win a merge.
export const DEFAULT_SETTINGS: Settings = {
  id: 'settings', timeFormat: '12h', defaultReminderOffsetMin: null, updatedAt: '1970-01-01T00:00:00.000Z',
}

export async function updateSettings(patch: Partial<Pick<Settings, 'timeFormat' | 'defaultReminderOffsetMin'>>) {
  await db.transaction('rw', db.settings, async () => {
    const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
    await db.settings.put({ ...cur, ...patch, updatedAt: nowIso() })
  })
}
