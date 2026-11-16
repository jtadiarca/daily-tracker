import { updateSettings } from '../../db/settingsRepo'
import { Select } from '../../components/Select'
import { BackupSection } from '../backup/BackupSection'
import { CategoryManager } from '../categories/CategoryManager'
import { VoiceSettings } from '../reminders/VoiceSettings'
import type { PermissionState } from '../reminders/notify'
import { PROBLEM_TEXT, useNotificationPermission } from '../reminders/usePermission'
import { ThemeSettings } from './ThemeSettings'
import { useInstallPrompt } from './useInstallPrompt'
import { useSettings } from './useSettings'

const DEFAULT_REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' }, { value: '0', label: 'At time of task' }, { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' },
]

const PERM_TEXT: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Blocked. Click the lock or site-settings icon at the left end of the address bar, set Notifications to Allow, then reload.',
  default: 'Not turned on yet',
  unsupported: 'Not supported in this browser',
}

export function SettingsView() {
  const s = useSettings()
  const install = useInstallPrompt()
  const { perm, ask, asking, problem } = useNotificationPermission()

  return (
    <section aria-labelledby="settings-h" className="page">
      <h1 id="settings-h" className="mb-6 text-3xl">Settings</h1>
      {/* One column on phones; on wide screens the cards flow into two columns like a newspaper. */}
      <div className="expanded:columns-2 expanded:gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">

      <CategoryManager />

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
        <Select label="Default reminder for timed tasks" className="mb-4" value={s.defaultReminderOffsetMin == null ? 'none' : String(s.defaultReminderOffsetMin)}
          onChange={v => void updateSettings({ defaultReminderOffsetMin: v === 'none' ? null : Number(v) })} options={DEFAULT_REMINDER_OPTIONS} />
        <p>Notification permission: <strong>{PERM_TEXT[perm]}</strong></p>
        {perm === 'default' && <button className="btn-filled mt-3" disabled={asking && problem !== 'waiting'} onClick={() => void ask()}>Turn on reminders</button>}
        {perm === 'default' && problem && <p role="status" className="mt-2 rounded-m3-sm bg-secondary-container p-3 text-sm text-on-secondary-container">{PROBLEM_TEXT[problem]}</p>}
        <p className="mt-2 text-sm text-on-surface-variant">This permission belongs to this device and is never included in backups.</p>
      </section>

      <VoiceSettings />

      <ThemeSettings />

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
      </div>
    </section>
  )
}
