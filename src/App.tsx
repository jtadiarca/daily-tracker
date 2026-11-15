import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet } from './components/TaskSheet'
import { TodayView } from './features/today/TodayView'
import { DashboardView } from './features/dashboard/DashboardView'
import { SettingsView } from './features/settings/SettingsView'
import { useSettings } from './features/settings/useSettings'
import { UpcomingView } from './features/upcoming/UpcomingView'
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
  setTimeFormat(settings.timeFormat)
  useReminders(date)

  useEffect(() => {
    const openToday = () => setTab('today')
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'OPEN_TODAY') openToday() }
    window.addEventListener('app:open-today', openToday)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => { window.removeEventListener('app:open-today', openToday); navigator.serviceWorker?.removeEventListener('message', onMsg) }
  }, [])

  const onEdit = (task: Task) => setSheet({ open: true, task })

  return (
    <main>
      <ToastHost onOpenToday={() => setTab('today')} />
      {tab === 'today' && <div className="mx-auto max-w-xl px-4 pt-4"><ReminderPrompt /></div>}
      {tab === 'today' ? <TodayView date={date} now={now} onEdit={onEdit} />
        : tab === 'upcoming' ? <UpcomingView date={date} onEdit={onEdit} />
        : tab === 'dashboard' ? <DashboardView now={now} />
        : <SettingsView />}
      <button aria-label="Add task" onClick={() => setSheet({ open: true, task: null })} className="fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full bg-indigo-700 text-3xl text-white shadow-lg">+</button>
      <TabBar tab={tab} onChange={setTab} /><TaskSheet open={sheet.open} task={sheet.task} date={date} onClose={() => setSheet({ open: false, task: null })} />
    </main>
  )
}
