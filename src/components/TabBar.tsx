export type Tab = 'today' | 'upcoming' | 'dashboard' | 'settings'
const tabs: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' },
  { id: 'dashboard', label: 'Dashboard' }, { id: 'settings', label: 'Settings' },
]
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-20 border-t bg-white dark:bg-slate-900 dark:border-slate-700">
      <ul className="flex max-w-xl mx-auto">
        {tabs.map(t => (
          <li key={t.id} className="flex-1">
            <button onClick={() => onChange(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`w-full py-3 text-sm ${tab === t.id ? 'font-semibold text-indigo-700 dark:text-indigo-300 underline' : ''}`}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
