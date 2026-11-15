import { useEffect, useState } from 'react'
import type { ToastMsg } from './toast'

// Material 3 snackbars. Kept at the top so reminders are hard to miss.
export function ToastHost({ onOpenToday }: { onOpenToday: () => void }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent<ToastMsg>).detail
      setToasts(cur => [...cur, t])
      window.setTimeout(() => setToasts(cur => cur.filter(x => x.id !== t.id)), 15000)
    }
    window.addEventListener('app:toast', h)
    return () => window.removeEventListener('app:toast', h)
  }, [])
  const dismiss = (id: string) => setToasts(cur => cur.filter(x => x.id !== id))
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl space-y-2 medium:left-24">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-1 rounded-m3-xs bg-inverse-surface p-4 text-inverse-on-surface shadow-m3-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Reminder: {t.title}</p><p className="text-sm opacity-80">{t.body}</p></div>
          <button className="min-h-[44px] rounded-full px-3 text-sm font-medium text-inverse-primary hover:bg-inverse-primary/10" onClick={() => { onOpenToday(); dismiss(t.id) }}>Open Today</button>
          <button className="min-h-[44px] rounded-full px-3 text-sm font-medium text-inverse-primary hover:bg-inverse-primary/10" onClick={() => dismiss(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}
