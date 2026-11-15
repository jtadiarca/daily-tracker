import { useEffect, useState } from 'react'
import { getPermission, requestPermission, type PermissionState } from './notify'

export function ReminderPrompt() {
  const [perm, setPerm] = useState<PermissionState>(getPermission())
  useEffect(() => {
    const refresh = () => setPerm(getPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const box = 'mb-4 rounded-m3-md bg-secondary-container p-4 text-sm text-on-secondary-container'
  if (perm === 'granted') return null
  if (perm === 'default') {
    return (
      <div className={box}>
        <p className="mb-3">Get a notification before a task is due.</p>
        <button className="btn-filled" onClick={async () => setPerm(await requestPermission())}>Turn on reminders</button>
      </div>
    )
  }
  if (perm === 'denied') {
    return <p className={box}>Notifications are blocked for this site. You will still get an in-app alert and a sound while the app is open. To change this, allow notifications in your browser's site settings.</p>
  }
  return <p className={box}>This browser does not support notifications. You will get an in-app alert and a sound while the app is open. On iPhone or iPad, add the app to your Home Screen first, then open it from there.</p>
}
