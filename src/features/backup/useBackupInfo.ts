import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

export function useBackupInfo() {
  return useLiveQuery(async () => {
    const last = (await db.meta.get('lastExportedAt'))?.value as string | undefined
    const tasks = await db.tasks.toArray()
    const completions = await db.completions.count()
    const categories = (await db.categories.toArray()).filter(c => !c.deletedAt).length
    const earliest = tasks.map(t => t.createdAt).sort()[0]
    return {
      lastExportedAt: last ?? null,
      earliestCreatedAt: earliest ?? null,
      hasData: tasks.some(t => !t.deletedAt) || completions > 0 || categories > 0,
    }
  }, [])
}
