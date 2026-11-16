import { PROBLEM_TEXT, useNotificationPermission } from './usePermission'

export function ReminderPrompt() {
  const { perm, ask, asking, problem } = useNotificationPermission()
  const box = 'mb-4 rounded-m3-md bg-secondary-container p-4 text-sm text-on-secondary-container'
  if (perm === 'granted') return null
  if (perm === 'default') {
    return (
      <div className={box}>
        <p className="mb-3">Get a notification before a task is due.</p>
        <button className="btn-filled" disabled={asking && problem !== 'waiting'} onClick={() => void ask()}>Turn on reminders</button>
        {problem && <p role="status" className="mt-3">{PROBLEM_TEXT[problem]}</p>}
      </div>
    )
  }
  if (perm === 'denied') {
    return <p className={box}>Notifications are blocked for this site. You will still get an in-app alert and the spoken reminder while the app is open. To change this, click the lock or site-settings icon at the left end of the address bar, set Notifications to Allow, then reload.</p>
  }
  return <p className={box}>This browser does not support notifications. You will get an in-app alert and the spoken reminder while the app is open. On iPhone or iPad, add the app to your Home Screen first, then open it from there.</p>
}
