import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ProgressRing } from '../../components/ProgressRing'
import { markDoneLate, rescheduleToToday } from '../../db/dashboardActions'
import { addDaysStr, parseDateStr, todayStr } from '../../lib/dates'
import { computeStreaks, dayStat, missedOccurrences, rangeStats, streakWindowStart } from '../../lib/stats'
import { formatTime } from '../../lib/time'
import { useDashboardData } from './useDashboardData'

type Preset = '7' | '30' | 'custom'

export function DashboardView({ now }: { now: Date }) {
  const data = useDashboardData()
  const today = todayStr(now)
  const [preset, setPreset] = useState<Preset>('7')
  const [customFrom, setCustomFrom] = useState(() => addDaysStr(todayStr(), -13))
  const [customTo, setCustomTo] = useState(() => todayStr())
  const [error, setError] = useState('')

  const from = preset === 'custom' ? customFrom : addDaysStr(today, -(Number(preset) - 1))
  const to = preset === 'custom' ? (customTo > today ? today : customTo) : today
  const rangeValid = !!from && !!to && from <= to && differenceInCalendarDays(parseDateStr(to), parseDateStr(from)) <= 365

  const nowMinute = Math.floor(now.getTime() / 60000)
  const snapshot = useMemo(() => new Date(nowMinute * 60000), [nowMinute])
  const doneSet = useMemo(() => new Set(data?.doneKeys ?? []), [data])

  // Streaks depend only on done/total counts, so they refresh when data or the day changes, not every minute.
  const streaks = useMemo(() => {
    if (!data) return { current: 0, best: 0 }
    return computeStreaks(rangeStats(data.tasks, doneSet, streakWindowStart(data.tasks, today), today, new Date()), today)
  }, [data, doneSet, today])

  const todayStat = useMemo(() => (data ? dayStat(data.tasks, doneSet, today, snapshot) : null), [data, doneSet, today, snapshot])
  const days = useMemo(() => (data && rangeValid ? rangeStats(data.tasks, doneSet, from, to, snapshot) : []), [data, doneSet, from, to, snapshot, rangeValid])
  const missed = useMemo(() => (data && rangeValid ? missedOccurrences(data.tasks, doneSet, from, to, snapshot) : []), [data, doneSet, from, to, snapshot, rangeValid])

  const withTasks = days.filter(d => d.total > 0)
  const doneSum = withTasks.reduce((s, d) => s + d.done, 0)
  const totalSum = withTasks.reduce((s, d) => s + d.total, 0)
  const avg = withTasks.length ? Math.round((withTasks.reduce((s, d) => s + (d.rate ?? 0), 0) / withTasks.length) * 100) : null
  const summary = avg === null ? 'No tasks in this range.' : `Average ${avg}% across ${withTasks.length} days with tasks (${doneSum} of ${totalSum} tasks done).`
  const chartData = days.map(d => ({
    label: format(parseDateStr(d.date), days.length > 14 ? 'M/d' : 'EEE M/d'),
    pct: d.rate === null ? null : Math.round(d.rate * 100),
  }))

  const act = async (work: () => Promise<unknown>) => {
    try { await work(); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the task') }
  }
  const tipStyle = { backgroundColor: 'rgb(var(--md-surface-container-high))', border: 'none', borderRadius: 8, color: 'rgb(var(--md-on-surface))' }

  return (
    <section aria-labelledby="dash-h" className="mx-auto max-w-xl space-y-6 p-4 pb-32">
      <h1 id="dash-h" className="text-3xl">Dashboard</h1>
      {error && <p role="alert" className="text-error">{error}</p>}

      <section aria-labelledby="today-h" className="card">
        <h2 id="today-h" className="mb-3 text-xl">Today</h2>
        {!todayStat ? <p>Loading…</p> : todayStat.total === 0 ? <p className="text-on-surface-variant">No tasks scheduled today.</p> : (
          <div className="flex items-center gap-4">
            <ProgressRing done={todayStat.done} total={todayStat.total} />
            <div>
              <p>{todayStat.done} of {todayStat.total} done</p>
              <p className="text-on-surface-variant">{todayStat.missed} missed{todayStat.missed > 0 ? ' (see the Missed tasks list below)' : ''}</p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="streak-h">
        <h2 id="streak-h" className="sr-only">Streaks</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-m3-md bg-primary-container p-4 text-on-primary-container"><p className="text-sm">Current streak</p><p className="text-4xl tabular-nums">{streaks.current} <span className="text-base">{streaks.current === 1 ? 'day' : 'days'}</span></p></div>
          <div className="rounded-m3-md bg-tertiary-container p-4 text-on-tertiary-container"><p className="text-sm">Best streak</p><p className="text-4xl tabular-nums">{streaks.best} <span className="text-base">{streaks.best === 1 ? 'day' : 'days'}</span></p></div>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">A streak day is a day with tasks where every task was done. Days with no tasks are skipped.</p>
      </section>

      <section aria-labelledby="range-h" className="card">
        <h2 id="range-h" className="mb-3 text-xl">Date range</h2>
        <div role="group" aria-label="Date range" className="flex flex-wrap gap-2">
          {(['7', '30', 'custom'] as Preset[]).map(p => (
            <button key={p} aria-pressed={preset === p} onClick={() => setPreset(p)} className={`chip ${preset === p ? 'chip-selected' : ''}`}>
              {p === 'custom' ? 'Custom' : `Last ${p} days`}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="field-label">From<input type="date" max={today} value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="field mt-1" /></label>
            <label className="field-label">To<input type="date" max={today} value={customTo} onChange={e => setCustomTo(e.target.value)} className="field mt-1" /></label>
          </div>
        )}
        {!rangeValid && <p role="alert" className="mt-3 text-error">Choose a range of up to 366 days, with the start on or before the end.</p>}
      </section>

      <section aria-labelledby="chart-h" className="card">
        <h2 id="chart-h" className="mb-1 text-xl">Completion rate per day</h2>
        <p className="mb-3 text-sm text-on-surface-variant">{summary}</p>
        {days.length > 0 && (
          <div role="img" aria-label={`Bar chart of daily completion rate. ${summary}`} className="h-56 w-full text-on-surface-variant">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.25} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: 'currentColor', fontSize: 12 }} stroke="currentColor" />
                <Tooltip contentStyle={tipStyle} labelStyle={{ color: 'rgb(var(--md-on-surface))' }} itemStyle={{ color: 'rgb(var(--md-on-surface))' }} formatter={(v) => (typeof v === 'number' ? `${v}%` : 'No tasks')} />
                <Bar dataKey="pct" fill="rgb(var(--md-primary))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {days.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-primary">View data as a table</summary>
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr><th scope="col">Date</th><th scope="col">Done</th><th scope="col">Total</th><th scope="col">Rate</th></tr></thead>
              <tbody>
                {days.map(d => (
                  <tr key={d.date}><td>{format(parseDateStr(d.date), 'EEE MMM d')}</td><td>{d.done}</td><td>{d.total}</td><td>{d.rate === null ? '-' : `${Math.round(d.rate * 100)}%`}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section aria-labelledby="missed-h">
        <h2 id="missed-h" className="mb-2 text-xl">Missed tasks</h2>
        {missed.length === 0 ? <p className="text-on-surface-variant">Nothing missed in this range.</p> : (
          <ul className="space-y-2">
            {missed.map(m => {
              const when = format(parseDateStr(m.date), 'EEE, MMM d')
              return (
                <li key={`${m.task.id}_${m.date}`} className="card">
                  <p className="font-medium">{m.task.title}</p>
                  <p className="text-sm text-on-surface-variant">{when}{m.task.time ? ` at ${formatTime(m.task.time)}` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-tonal" aria-label={`Mark ${m.task.title} from ${when} done late`} onClick={() => act(() => markDoneLate(m.task.id, m.date))}>Mark done late</button>
                    <button className="btn-outlined" aria-label={`Reschedule ${m.task.title} from ${when} to today`} onClick={() => act(() => rescheduleToToday(m.task.id, m.date, new Date()))}>Reschedule to today</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </section>
  )
}
