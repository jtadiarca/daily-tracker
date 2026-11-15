import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Settings } from '../../db/types'
import { DEFAULT_SETTINGS } from '../../db/settingsRepo'

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('settings'), [])
  return s ?? DEFAULT_SETTINGS
}
