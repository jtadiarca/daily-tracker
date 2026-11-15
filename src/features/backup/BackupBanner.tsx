import { useState } from 'react'
import { exportReminderDue } from '../../lib/exportReminder'
import { useBackupInfo } from './useBackupInfo'

export function BackupBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  const info = useBackupInfo()
  const [dismissed, setDismissed] = useState(false)
  if (!info || dismissed || !exportReminderDue({ ...info, now: new Date() })) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      <p className="flex-1">It has been over 14 days since your last backup. Export one so your tasks are safe if this device is lost.</p>
      <button className="rounded bg-indigo-700 px-3 py-2 text-white" onClick={onGoToSettings}>Back up now</button>
      <button className="px-2 py-2 underline" onClick={() => setDismissed(true)}>Dismiss</button>
    </div>
  )
}
