import { useEffect, useState } from 'react'
import { getPermission, requestPermission, type PermissionState } from './notify'

export function ReminderPrompt() {
  const [perm, setPerm] = useState<PermissionState>(getPermission())
  useEffect(() => {
    const refresh = () => setPerm(getPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const box = 'mb-4 rounded-lg border border-slate-400 bg-white p-3 text-sm dark:bg-slate-800'
  if (perm === 'granted') return null
  if (perm === 'default') {
    return (
      <div className={box}>
        <p className="mb-2">Get a notification before a task is due.</p>
        <button className="rounded bg-indigo-700 px-3 py-2 text-white" onClick={async () => setPerm(await requestPermission())}>Turn on reminders</button>
      </div>
    )
  }
  if (perm === 'denied') {
    return <p className={box}>Notifications are blocked for this site. You will still get an in-app alert and a sound while the app is open. To change this, allow notifications in your browser's site settings.</p>
  }
  return <p className={box}>This browser does not support notifications. You will get an in-app alert and a sound while the app is open. On iPhone or iPad, add the app to your Home Screen first, then open it from there.</p>
}
