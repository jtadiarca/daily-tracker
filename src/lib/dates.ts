import { format, parse, addDays } from 'date-fns'

export const DATE_FMT = 'yyyy-MM-dd'
export const toDateStr = (d: Date) => format(d, DATE_FMT)
export const todayStr = (now = new Date()) => toDateStr(now)
export const parseDateStr = (s: string) => parse(s, DATE_FMT, new Date(2000, 0, 1))
export const addDaysStr = (s: string, n: number) => toDateStr(addDays(parseDateStr(s), n))
export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()
export const completionId = (taskId: string, date: string) => `${taskId}_${date}`
