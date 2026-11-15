import { useState } from 'react'
import { exportReminderDue } from '../../lib/exportReminder'
import { useBackupInfo } from './useBackupInfo'

export function BackupBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  const info = useBackupInfo()
  const [dismissed, setDismissed] = useState(false)
  if (!info || dismissed || !exportReminderDue({ ...info, now: new Date() })) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-m3-md bg-tertiary-container p-4 text-sm text-on-tertiary-container">
      <p className="min-w-0 flex-1">It has been over 14 days since your last backup. Export one so your tasks are safe if this device is lost.</p>
      <button className="btn-filled" onClick={onGoToSettings}>Back up now</button>
      <button className="btn-text text-on-tertiary-container" onClick={() => setDismissed(true)}>Dismiss</button>
    </div>
  )
}
