import { useEffect, useState } from 'react'
import { updateSettings } from '../../db/settingsRepo'
import { BackupSection } from '../backup/BackupSection'
import { getPermission, requestPermission, type PermissionState } from '../reminders/notify'
import { useInstallPrompt } from './useInstallPrompt'
import { useSettings } from './useSettings'

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
    <section aria-labelledby="settings-h" className="mx-auto max-w-xl space-y-6 p-4 pb-32">
      <h1 id="settings-h" className="text-3xl">Settings</h1>

      <BackupSection />

      <section aria-labelledby="install-h" className="card">
        <h2 id="install-h" className="mb-2 text-xl">Install</h2>
        {install.installed ? <p>The app is installed on this device.</p>
          : install.canInstall ? <button className="btn-filled" onClick={() => void install.install()}>Install app</button>
          : install.isIos ? <p>On iPhone or iPad, tap the Share button, then Add to Home Screen. Notifications only work after you install the app this way.</p>
          : <p>To install, use your browser menu (Install app or Add to Home screen). It works offline after the first load.</p>}
      </section>

      <section aria-labelledby="rem-h" className="card">
        <h2 id="rem-h" className="mb-3 text-xl">Reminders</h2>
        <label className="field-label mb-4">Default reminder for timed tasks
          <select className="field mt-1" value={s.defaultReminderOffsetMin == null ? 'none' : String(s.defaultReminderOffsetMin)}
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
        {perm === 'default' && <button className="btn-filled mt-3" onClick={async () => setPerm(await requestPermission())}>Turn on reminders</button>}
        <p className="mt-2 text-sm text-on-surface-variant">This permission belongs to this device and is never included in backups.</p>
      </section>

      <section aria-labelledby="time-h" className="card">
        <fieldset>
          <legend id="time-h" className="mb-2 text-xl">Time format</legend>
          {(['12h', '24h'] as const).map(f => (
            <label key={f} className="flex min-h-[44px] items-center gap-3">
              <input type="radio" name="timeFormat" className="h-5 w-5" checked={s.timeFormat === f} onChange={() => void updateSettings({ timeFormat: f })} />
              {f === '24h' ? '24-hour (13:30)' : '12-hour (1:30 PM)'}
            </label>
          ))}
        </fieldset>
      </section>
    </section>
  )
}
