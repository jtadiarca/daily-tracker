export type Tab = 'today' | 'upcoming' | 'dashboard' | 'settings'

// Material icon paths (24px grid).
const ICONS: Record<Tab, string> = {
  today: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  upcoming: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  dashboard: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' },
  { id: 'dashboard', label: 'Dashboard' }, { id: 'settings', label: 'Settings' },
]

const ADD_ICON = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'

// Material 3 navigation. On phones in portrait it is a bottom navigation bar (icon in a pill when
// active, label underneath). From 600px wide (landscape phones, tablets, desktops) it becomes a
// navigation rail on the left: the add button at the top with the tabs directly below it.
export function TabBar({ tab, onChange, onAdd }: { tab: Tab; onChange: (t: Tab) => void; onAdd: () => void }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 bg-surface-container medium:inset-y-0 medium:right-auto medium:flex medium:w-20 medium:flex-col medium:items-center medium:gap-6 medium:overflow-y-auto medium:py-6 short:gap-2 short:py-3">
      <button aria-label="Add task" onClick={onAdd}
        className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-m3-lg bg-primary-container text-on-primary-container shadow-m3-1 transition hover:shadow-m3-2 medium:flex short:h-12 short:w-12">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d={ADD_ICON} /></svg>
      </button>
      <ul className="mx-auto flex max-w-xl medium:mx-0 medium:flex-col medium:gap-3 short:gap-1">
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <li key={t.id} className="flex-1 medium:flex-none">
              <button onClick={() => onChange(t.id)} aria-current={active ? 'page' : undefined}
                className="flex w-full flex-col items-center gap-1 pb-4 pt-3 medium:w-20 medium:py-1 short:py-0.5">
                <span className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors medium:w-14 ${active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d={ICONS[t.id]} /></svg>
                </span>
                <span className={`text-xs font-medium ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{t.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
