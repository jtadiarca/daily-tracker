import { useEffect, useState } from 'react'
import { updateSettings } from '../../db/settingsRepo'
import { getPermission, requestPermission, type PermissionState } from '../reminders/notify'
import { useInstallPrompt } from './useInstallPrompt'
import { useSettings } from './useSettings'

const card = 'rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800'
const field = 'w-full rounded-lg border border-slate-400 bg-white px-3 py-2 dark:bg-slate-900'
const PERM_TEXT: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Blocked. Allow notifications for this site in your browser settings.',
  default: 'Not asked yet',
  unsupported: 'Not supported in this browser',
}

export function SettingsView() {
  const s = useSettings()
  const install = useInstallPrompt()
  const [perm, setPerm] = useState<PermissionState>(getPermission())
  useEffect(() => {
    const refresh = () => setPerm(getPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  return (
    <section aria-labelledby="settings-h" className="mx-auto max-w-xl space-y-6 p-4 pb-28">
      <h1 id="settings-h" className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="install-h" className={card}>
        <h2 id="install-h" className="mb-2 text-lg font-semibold">Install</h2>
        {install.installed ? <p>The app is installed on this device.</p>
          : install.canInstall ? <button className="rounded bg-indigo-700 px-4 py-2 text-white" onClick={() => void install.install()}>Install app</button>
          : install.isIos ? <p>On iPhone or iPad, tap the Share button, then Add to Home Screen. Notifications only work after you install the app this way.</p>
          : <p>To install, use your browser menu (Install app or Add to Home screen). It works offline after the first load.</p>}
      </section>

      <section aria-labelledby="rem-h" className={card}>
        <h2 id="rem-h" className="mb-3 text-lg font-semibold">Reminders</h2>
        <label className="mb-4 block">Default reminder for timed tasks
          <select className={field} value={s.defaultReminderOffsetMin == null ? 'none' : String(s.defaultReminderOffsetMin)}
            onChange={e => void updateSettings({ defaultReminderOffsetMin: e.target.value === 'none' ? null : Number(e.target.value) })}>
            <option value="none">No reminder</option>
            <option value="0">At time of task</option>
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
          </select>
        </label>
        <p>Notification permission: <strong>{PERM_TEXT[perm]}</strong></p>
        {perm === 'default' && <button className="mt-2 rounded bg-indigo-700 px-4 py-2 text-white" onClick={async () => setPerm(await requestPermission())}>Turn on reminders</button>}
        <p className="mt-2 text-sm">This permission belongs to this device and is never included in backups.</p>
      </section>

      <section aria-labelledby="time-h" className={card}>
        <fieldset>
          <legend id="time-h" className="mb-2 text-lg font-semibold">Time format</legend>
          {(['24h', '12h'] as const).map(f => (
            <label key={f} className="flex items-center gap-2 py-2">
              <input type="radio" name="timeFormat" checked={s.timeFormat === f} onChange={() => void updateSettings({ timeFormat: f })} />
              {f === '24h' ? '24-hour (13:30)' : '12-hour (1:30 PM)'}
            </label>
          ))}
        </fieldset>
      </section>
    </section>
  )
}
