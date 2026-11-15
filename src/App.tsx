import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet } from './components/TaskSheet'
import { TodayView } from './features/today/TodayView'
import { todayStr } from './lib/dates'
import type { Task } from './db/types'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [sheet, setSheet] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const date = todayStr()

  return (
    <main>
      {tab === 'today' && <TodayView date={date} onEdit={task => setSheet({ open: true, task })} />}
      {tab !== 'today' && <p className="p-4">Coming in a later milestone.</p>}
      <button aria-label="Add task" onClick={() => setSheet({ open: true, task: null })}
        className="fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full bg-indigo-700 text-white text-3xl shadow-lg">+</button>
      <TabBar tab={tab} onChange={setTab} />
      <TaskSheet open={sheet.open} task={sheet.task} date={date} onClose={() => setSheet({ open: false, task: null })} />
    </main>
  )
}
