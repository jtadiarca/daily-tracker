import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

export function useDashboardData() {
  return useLiveQuery(async () => {
    const tasks = (await db.tasks.toArray()).filter(t => !t.deletedAt)
    const doneKeys = (await db.completions.toArray()).filter(c => !c.deletedAt).map(c => c.id)
    return { tasks, doneKeys }
  }, [])
}
