import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { buildEnvelope, recordExported } from '../../db/backup'
import { driveBackupName, type DriveFile } from '../../lib/drive'
import { downloadBackup, driveConfigured, getAccessToken, isSignedIn, listBackups, loadGoogleSignIn, signOut, uploadBackup } from './googleDrive'

type Msg = { kind: 'ok' | 'error'; text: string }

// Save backups to, and restore them from, a "Daily Tracker backups" folder in the person's Google Drive.
// Restoring hands the file to the same preview, merge and undo flow as importing a file.
export function GoogleDriveSection({ onImportText, onMessage }: {
  onImportText: (text: string, sizeBytes: number) => Promise<void>
  onMessage: (m: Msg | null) => void
}) {
  const [signedIn, setSignedIn] = useState(isSignedIn())
  const [busy, setBusy] = useState<'' | 'save' | 'list' | 'restore'>('')
  const [files, setFiles] = useState<DriveFile[] | null>(null)

  // Load Google's sign-in script ahead of time so the sign-in popup can open as soon as a button is pressed.
  useEffect(() => { if (driveConfigured()) loadGoogleSignIn().catch(() => { /* reported when a button is used */ }) }, [])

  if (!driveConfigured()) {
    return (
      <div className="mt-4">
        <h3 className="section-title mb-1">Google Drive</h3>
        <p className="text-sm text-on-surface-variant">Google Drive backup isn’t set up for this copy of the app. The README explains how to add a Google client ID.</p>
      </div>
    )
  }

  const run = async (kind: 'save' | 'list' | 'restore', work: () => Promise<void>) => {
    onMessage(null); setBusy(kind)
    try { await work() } catch (e) { onMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Google Drive request failed.' }) }
    finally { setBusy(''); setSignedIn(isSignedIn()) }
  }

  // Ask for the Google token first, while the click still counts, so the browser lets the sign-in popup open.
  const save = () => run('save', async () => {
    await getAccessToken()
    const env = await buildEnvelope()
    const f = await uploadBackup(driveBackupName(new Date()), JSON.stringify(env))
    await recordExported()
    onMessage({ kind: 'ok', text: `Saved “${f.name}” to the “Daily Tracker backups” folder in your Google Drive.` })
    if (files) setFiles([f, ...files])
  })

  const browse = () => run('list', async () => {
    await getAccessToken()
    const list = await listBackups()
    setFiles(list)
    if (list.length === 0) onMessage({ kind: 'ok', text: 'No backups from this app in your Google Drive yet. Use “Save to Google Drive” first.' })
  })

  const restore = (f: DriveFile) => run('restore', async () => {
    const text = await downloadBackup(f.id)
    setFiles(null)
    await onImportText(text, Number(f.size ?? text.length))
  })

  const switchAccount = () => run('list', async () => { signOut(); setFiles(null); await getAccessToken(true) })

  return (
    <div className="mt-4">
      <h3 className="section-title mb-1">Google Drive</h3>
      <p className="mb-3 text-sm text-on-surface-variant">
        Sign in with Google to keep backups in a “Daily Tracker backups” folder in your Drive. The app can only see the files it saves there.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-tonal" disabled={!!busy} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save to Google Drive'}</button>
        <button className="btn-outlined" disabled={!!busy} onClick={() => void browse()}>{busy === 'list' ? 'Opening…' : 'Restore from Google Drive'}</button>
        {signedIn && <button className="btn-text" disabled={!!busy} onClick={() => void switchAccount()}>Use another account</button>}
        {signedIn && <button className="btn-text" disabled={!!busy} onClick={() => { signOut(); setSignedIn(false); setFiles(null); onMessage({ kind: 'ok', text: 'Signed out of Google Drive.' }) }}>Sign out</button>}
      </div>

      {files && files.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm text-on-surface-variant">Choose a backup to restore. You’ll see what it contains before anything changes.</p>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {files.map(f => (
              <li key={f.id}>
                <button disabled={!!busy} onClick={() => void restore(f)}
                  className="flex min-h-[48px] w-full flex-wrap items-center justify-between gap-x-3 rounded-m3-sm bg-surface-container px-3 py-2 text-left hover:bg-surface-container-high disabled:opacity-40">
                  <span className="min-w-0 break-all">{f.name}</span>
                  <span className="text-sm text-on-surface-variant">{format(new Date(f.modifiedTime), 'PP p')}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-text mt-1" onClick={() => setFiles(null)}>Cancel</button>
        </div>
      )}
    </div>
  )
}
