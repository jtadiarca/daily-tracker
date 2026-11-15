import type { Reminder } from '../../lib/reminders'
import { formatTime } from '../../lib/time'
import { emitToast, playBeep, speak } from './toast'

export type PermissionState = 'unsupported' | NotificationPermission

export function getPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

// Must be called from a user action (button click).
export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try { await Notification.requestPermission() } catch { /* older browsers use callbacks; state is re-read below */ }
  return getPermission()
}

export async function deliver(r: Reminder) {
  const body = `Due at ${r.time}`
  if (getPermission() === 'granted') {
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
      if (reg) {
        await reg.showNotification(r.title, { body, tag: r.id, data: { url: '/?view=today' } })
        return
      }
      const n = new Notification(r.title, { body, tag: r.id })
      n.onclick = () => { window.focus(); window.dispatchEvent(new Event('app:open-today')); n.close() }
      return
    } catch { /* fall through to the in-app alert */ }
  }
  emitToast({ title: r.title, body })
  if (!speak(`Reminder. ${r.title}. Due at ${formatTime(r.time, '12h')}.`)) playBeep()
}
