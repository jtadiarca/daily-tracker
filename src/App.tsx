import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet } from './components/TaskSheet'
import { purgeOldTombstones } from './db/backup'
import { BackupBanner } from './features/backup/BackupBanner'
import { TodayView } from './features/today/TodayView'
import { DashboardView } from './features/dashboard/DashboardView'
import { SettingsView } from './features/settings/SettingsView'
import { useSettings } from './features/settings/useSettings'
import { UpcomingView } from './features/upcoming/UpcomingView'
import { useCategories } from './features/categories/useCategories'
import { useCategoryView } from './features/categories/useCategoryView'
import { categoryForFilter } from './lib/categories'
import { ReminderPrompt } from './features/reminders/ReminderPrompt'
import { ToastHost } from './features/reminders/ToastHost'
import { useReminders } from './features/reminders/useReminders'
import { todayStr } from './lib/dates'
import { setTimeFormat } from './lib/time'
import { useNow } from './lib/useNow'
import type { Task } from './db/types'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [sheet, setSheet] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const now = useNow()
  const date = todayStr(now)
  const settings = useSettings()
  const categories = useCategories()
  const view = useCategoryView()
  setTimeFormat(settings.timeFormat)
  useReminders(date)

  useEffect(() => { void purgeOldTombstones() }, [])

  useEffect(() => {
    const openToday = () => setTab('today')
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'OPEN_TODAY') openToday() }
    window.addEventListener('app:open-today', openToday)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => { window.removeEventListener('app:open-today', openToday); navigator.serviceWorker?.removeEventListener('message', onMsg) }
  }, [])

  const onEdit = (task: Task) => setSheet({ open: true, task })

  return (
    // From 600px wide the navigation is a rail on the left, so the content moves over by its width.
    <main className="medium:pl-20">
      <ToastHost onOpenToday={() => setTab('today')} />
      {tab === 'today' && (
        <div className="page-width px-4 pt-4 medium:px-6">
          <BackupBanner onGoToSettings={() => setTab('settings')} />
          <ReminderPrompt />
        </div>
      )}
      {tab === 'today' ? <TodayView date={date} now={now} categories={categories} view={view} onEdit={onEdit} />
        : tab === 'upcoming' ? <UpcomingView date={date} categories={categories} view={view} onEdit={onEdit} />
        : tab === 'dashboard' ? <DashboardView now={now} />
        : <SettingsView />}
      {/* Floating add button for phones in portrait; the navigation rail has its own from 600px. */}
      <button aria-label="Add task" onClick={() => setSheet({ open: true, task: null })}
        className="fixed bottom-24 right-4 z-20 flex medium:hidden h-14 w-14 items-center justify-center rounded-m3-lg bg-primary-container text-on-primary-container shadow-m3-3 transition hover:shadow-m3-2">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
      </button>
      <TabBar tab={tab} onChange={setTab} onAdd={() => setSheet({ open: true, task: null })} /><TaskSheet open={sheet.open} task={sheet.task} date={date} categories={categories} defaultCategoryId={categoryForFilter(view.filter, categories)} onClose={() => setSheet({ open: false, task: null })} />
    </main>
  )
}
