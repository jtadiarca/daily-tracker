import { todayStr, parseDateStr } from './dates'
export type Status = 'done' | 'upcoming' | 'missed'
export function deriveStatus({ date, time, done, now }: { date: string; time?: string; done: boolean; now: Date }): Status {
  if (done) return 'done'
  const today = todayStr(now)
  if (date < today) return 'missed'
  if (date > today || !time) return 'upcoming'
  const due = parseDateStr(date)
  const [hours, minutes] = time.split(':').map(Number)
  due.setHours(hours, minutes, 0, 0)
  return now.getTime() > due.getTime() ? 'missed' : 'upcoming'
}
