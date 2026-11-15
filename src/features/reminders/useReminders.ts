import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addDaysStr, todayStr } from '../../lib/dates'
import { planReminders } from '../../lib/reminders'
import { loadFired, markFired } from './fired'
import { deliver } from './notify'

// Schedules setTimeout timers while the app is open. Everything is re-planned whenever
// tasks, completions or settings change, when the day rolls over, and when the tab regains focus.
export function useReminders(date: string) {
  const data = useLiveQuery(async () => {
    const next = addDaysStr(date, 1)
    const tasks = (await db.tasks.toArray()).filter(t => !t.deletedAt && (t.time || (t.times && t.times.length > 0)))
    const comps = (await db.completions.where('date').anyOf([date, next]).toArray()).filter(c => !c.deletedAt)
    const s = await db.settings.get('settings')
    return { tasks, doneKeys: comps.map(c => c.id), defaultOffset: s?.defaultReminderOffsetMin ?? null }
  }, [date])

  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const bump = () => setEpoch(e => e + 1)
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
    return () => { document.removeEventListener('visibilitychange', bump); window.removeEventListener('focus', bump) }
  }, [])

  useEffect(() => {
    if (!data) return
    const now = new Date()
    const { fireNow, scheduled } = planReminders({
      tasks: data.tasks, doneKeys: new Set(data.doneKeys), firedIds: loadFired(),
      now, defaultOffset: data.defaultOffset,
    })
    const fire = (r: (typeof fireNow)[number]) => { markFired(r.id); void deliver(r) }
    fireNow.forEach(fire)
    const timers = scheduled.map(r => window.setTimeout(() => fire(r), Math.max(0, r.fireAt.getTime() - Date.now())))
    return () => timers.forEach(window.clearTimeout)
  }, [data, epoch, date])

  return todayStr()
}
