import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category } from '../../db/types'
import { liveCategories } from '../../lib/categories'

const NONE: Category[] = []

// The categories that have not been deleted, oldest first. Empty while the database is still loading.
export function useCategories(): Category[] {
  const rows = useLiveQuery(() => db.categories.toArray(), [])
  return useMemo(() => (rows ? liveCategories(rows) : NONE), [rows])
}
