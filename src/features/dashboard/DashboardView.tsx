import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ProgressRing } from '../../components/ProgressRing'
import { DatePicker } from '../../components/DatePicker'
import { markDoneLate, rescheduleToToday } from '../../db/dashboardActions'
import { addDaysStr, parseDateStr, todayStr } from '../../lib/dates'
import { categoryOf, effectiveFilter, FILTER_ALL, FILTER_NONE, matchesFilter } from '../../lib/categories'
import { categoryBreakdown, computeStreaks, dayStat, missedOccurrences, rangeStats, streakWindowStart } from '../../lib/stats'
import { formatTime } from '../../lib/time'
import { CategoryFilter } from '../categories/CategoryFilter'
import { useCategories } from '../categories/useCategories'
import { useDashboardCategoryFilter } from '../categories/useCategoryView'
import { useDashboardData } from './useDashboardData'

type Preset = '7' | '30' | 'custom'

export function DashboardView({ now }: { now: Date }) {
  const raw = useDashboardData()
  const categories = useCategories()
  const catView = useDashboardCategoryFilter()
  const filter = effectiveFilter(catView.filter, categories)
  // Every number on the page follows the category filter, so filter the tasks once up front.
  const data = useMemo(
    () => (raw ? { ...raw, tasks: raw.tasks.filter(t => matchesFilter(t, filter, categories)) } : undefined),
    [raw, filter, categories],
  )
  const filterLabel = filter === FILTER_ALL ? null : filter === FILTER_NONE ? 'tasks with no category' : `“${categories.find(c => c.id === filter)?.name}”`
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
  const doneSet = useMemo(() => new Set(raw?.doneKeys ?? []), [raw])

  // Streaks depend only on done/total counts, so they refresh when data or the day changes, not every minute.
  const streaks = useMemo(() => {
    if (!data) return { current: 0, best: 0 }
    return computeStreaks(rangeStats(data.tasks, doneSet, streakWindowStart(data.tasks, today), today, new Date()), today)
  }, [data, doneSet, today])

  const todayStat = useMemo(() => (data ? dayStat(data.tasks, doneSet, today, snapshot) : null), [data, doneSet, today, snapshot])
  const days = useMemo(() => (data && rangeValid ? rangeStats(data.tasks, doneSet, from, to, snapshot) : []), [data, doneSet, from, to, snapshot, rangeValid])
  const missed = useMemo(() => (data && rangeValid ? missedOccurrences(data.tasks, doneSet, from, to, snapshot) : []), [data, doneSet, from, to, snapshot, rangeValid])
  const showBreakdown = filter === FILTER_ALL && categories.length > 0
  const breakdown = useMemo(
    () => (data && rangeValid && showBreakdown ? categoryBreakdown(data.tasks, doneSet, categories, from, to, snapshot) : []),
    [data, doneSet, categories, from, to, snapshot, rangeValid, showBreakdown],
  )

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
    <section aria-labelledby="dash-h" className="page space-y-6">
      <h1 id="dash-h" className="text-3xl">Dashboard</h1>
      {error && <p role="alert" className="text-error">{error}</p>}
      <div>
        <CategoryFilter categories={categories} view={catView} showGroupBy={false} />
        {filterLabel && <p className="-mt-2 text-sm text-on-surface-variant">Showing only {filterLabel}. Progress, streaks, the chart and missed tasks count these tasks only.</p>}
      </div>

      {/* Wide screens: progress, streaks, range and chart on the left; categories and missed tasks on the right. */}
      <div className="cols-2">
      <div className="space-y-6">
      <section aria-labelledby="today-h" className="card">
        <h2 id="today-h" className="mb-3 text-xl">Today</h2>
        {!todayStat ? <p>Loading…</p> : todayStat.total === 0 ? <p className="text-on-surface-variant">No tasks scheduled today.</p> : (
          <div className="flex items-center gap-4">
            <ProgressRing done={todayStat.done} total={todayStat.total} />
            <div>
              <p>{todayStat.done} of {todayStat.total} done</p>
              <p className="text-on-surface-variant">{todayStat.missed} missed{todayStat.missed > 0 ? ' (see Missed tasks)' : ''}</p>
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
            <DatePicker label="From" required max={today} value={customFrom} onChange={setCustomFrom} />
            <DatePicker label="To" required max={today} value={customTo} onChange={setCustomTo} />
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

      </div>

      <div className="space-y-6">
      {showBreakdown && (
        <section aria-labelledby="bycat-h" className="card">
          <h2 id="bycat-h" className="mb-1 text-xl">By category</h2>
          <p className="mb-3 text-sm text-on-surface-variant">Completion rate for each category in the selected range. Tap a name to show only that category.</p>
          {breakdown.length === 0 ? <p className="text-on-surface-variant">No tasks in this range.</p> : (
            <ul className="space-y-3">
              {breakdown.map(r => {
                const name = r.category?.name ?? 'No category'
                const pct = Math.round((r.rate ?? 0) * 100)
                return (
                  <li key={r.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <button type="button" className="min-w-0 break-words text-left font-medium text-primary hover:underline" aria-label={`Show only ${name}`} onClick={() => catView.setFilter(r.key)}>{name}</button>
                      <span className="text-sm tabular-nums text-on-surface-variant">{pct}% · {r.done} of {r.total} done{r.missed > 0 ? ` · ${r.missed} missed` : ''}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="missed-h">
        <h2 id="missed-h" className="mb-2 text-xl">Missed tasks</h2>
        {missed.length === 0 ? <p className="text-on-surface-variant">Nothing missed in this range.</p> : (
          <ul className="space-y-2">
            {missed.map(m => {
              const day = format(parseDateStr(m.date), 'EEE, MMM d')
              const dueAt = m.slot ?? m.task.time
              const when = dueAt ? `${day} at ${formatTime(dueAt)}` : day
              return (
                <li key={`${m.task.id}_${m.date}_${m.slot ?? ''}`} className="card">
                  <p className="font-medium">{m.task.title}</p>
                  <p className="text-sm text-on-surface-variant">{when}{showBreakdown ? ` · ${categoryOf(m.task, categories)?.name ?? 'No category'}` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-tonal" aria-label={`Mark ${m.task.title} from ${when} done late`} onClick={() => act(() => markDoneLate(m.task, m.date, m.slot))}>Mark done late</button>
                    <button className="btn-outlined" aria-label={`Reschedule ${m.task.title} from ${when} to today`} onClick={() => act(() => rescheduleToToday(m.task.id, m.date, m.slot, new Date()))}>Reschedule to today</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      </div>
      </div>
    </section>
  )
}
