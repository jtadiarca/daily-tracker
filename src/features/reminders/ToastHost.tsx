import { useEffect, useState } from 'react'
import type { ToastMsg } from './toast'

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
    <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl space-y-2">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 rounded-lg border border-indigo-700 bg-white p-3 shadow-lg dark:bg-slate-800">
          <div className="min-w-0 flex-1"><p className="font-semibold">Reminder: {t.title}</p><p className="text-sm">{t.body}</p></div>
          <button className="rounded border px-3 py-2 text-sm" onClick={() => { onOpenToday(); dismiss(t.id) }}>Open Today</button>
          <button className="px-2 py-2 text-sm underline" onClick={() => dismiss(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}
