import { buildEnvelope, recordExported } from '../../db/backup'
import { todayStr } from '../../lib/dates'

const isMobile = () =>
  /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent))

// Shares the file on mobile when the browser can share files, otherwise downloads it.
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const env = await buildEnvelope()
  const filename = `daily-tracker-backup-${todayStr()}.json`
  const blob = new Blob([JSON.stringify(env)], { type: 'application/json' })
  const file = new File([blob], filename, { type: 'application/json' })

  if (isMobile() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Daily Task Tracker backup' })
      await recordExported()
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Any other sharing problem: fall back to a normal download.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  await recordExported()
  return 'downloaded'
}
