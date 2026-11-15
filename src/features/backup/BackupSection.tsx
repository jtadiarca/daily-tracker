import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { clearAllData, hasSnapshot, previewImport, undoImport, type ImportPreview, type ImportResult } from '../../db/backup'
import { skippedCount } from '../../lib/merge'
import { exportBackup } from './exportFile'
import { ImportDialog } from './ImportDialog'
import { useBackupInfo } from './useBackupInfo'

const LARGE_FILE_BYTES = 10 * 1024 * 1024
type Msg = { kind: 'ok' | 'error'; text: string } | null

export function BackupSection() {
  const info = useBackupInfo()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [canUndo, setCanUndo] = useState(hasSnapshot())
  const [dragging, setDragging] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const fail = (e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' })

  const onExport = async () => {
    setMsg(null)
    try {
      const r = await exportBackup()
      if (r === 'shared') setMsg({ kind: 'ok', text: 'Backup shared.' })
      if (r === 'downloaded') setMsg({ kind: 'ok', text: 'Backup downloaded. Keep the file somewhere safe, and open it on your other device to transfer your data.' })
    } catch (e) { fail(e) }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setMsg(null)
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setMsg({ kind: 'error', text: 'Please choose a .json backup file.' })
      return
    }
    if (file.size > LARGE_FILE_BYTES &&
      !window.confirm(`This file is ${(file.size / 1048576).toFixed(1)} MB, much larger than a normal backup. Importing it may be slow. Continue?`)) return
    try {
      const res = await previewImport(await file.text())
      if (res.ok) setPreview(res.preview)
      else setMsg({ kind: 'error', text: res.error })
    } catch (e) { fail(e) }
  }

  const onDone = (r: ImportResult) => {
    setPreview(null)
    setCanUndo(true)
    setMsg({
      kind: 'ok',
      text: r.mode === 'replace'
        ? `Replaced everything: loaded ${r.loaded.tasks} tasks and ${r.loaded.completions} completions.`
        : `Import complete. Added ${r.summary.added}, updated ${r.summary.updated}, skipped ${skippedCount(r.summary)}` +
          (r.summary.skippedFuture ? ` (${r.summary.skippedFuture} ignored for future timestamps).` : '.'),
    })
  }

  const onUndo = async () => {
    try {
      const ok = await undoImport()
      setCanUndo(false)
      setMsg(ok ? { kind: 'ok', text: 'Import undone. Any changes you made after the import were removed too.' } : null)
    } catch (e) { fail(e) }
  }

  const onClear = async () => {
    try {
      await clearAllData()
      setClearOpen(false); setConfirmText(''); setCanUndo(false)
      setMsg({ kind: 'ok', text: 'All data was deleted from this device.' })
    } catch (e) { fail(e) }
  }

  return (
    <section aria-labelledby="backup-h" className="card">
      <h2 id="backup-h" className="mb-2 text-xl">Backup and transfer</h2>
      <p className="mb-3 text-sm text-on-surface-variant">Export a backup file on one device and import it on another. Your data never leaves your devices.</p>
      <p className="mb-3">Last exported: <strong>{info?.lastExportedAt ? format(new Date(info.lastExportedAt), 'PPP p') : 'never'}</strong></p>

      <div className="flex flex-wrap gap-2">
        <button className="btn-filled" onClick={() => void onExport()}>Export data</button>
        <button className="btn-outlined" onClick={() => fileRef.current?.click()}>Import data</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose backup file"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void handleFile(f) }} />
      </div>

      <div className={`mt-3 hidden rounded-m3-md border-2 border-dashed p-4 text-center text-sm text-on-surface-variant sm:block ${dragging ? 'border-primary bg-primary/10' : 'border-outline-variant'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]) }}>
        Or drag a backup file here
      </div>

      {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`mt-3 ${msg.kind === 'error' ? 'text-error' : ''}`}>{msg.text}</p>}
      {canUndo && (
        <div className="mt-3">
          <button className="btn-tonal" onClick={() => void onUndo()}>Undo import</button>
          <p className="mt-1 text-sm text-on-surface-variant">Available until you next open the app. It also removes changes made since the import.</p>
        </div>
      )}

      <hr className="my-4 border-outline-variant" />
      {!clearOpen ? (
        <button className="btn-outlined-error" onClick={() => setClearOpen(true)}>Clear all data…</button>
      ) : (
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (confirmText === 'DELETE') void onClear() }}>
          <p role="alert" className="rounded-m3-sm bg-error-container p-3 text-on-error-container">This permanently deletes every task, completion and setting on this device. Export a backup first if you might want them back.</p>
          <label className="field-label">Type DELETE to confirm
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" className="field mt-1" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={confirmText !== 'DELETE'} className="btn-filled-error">Delete everything</button>
            <button type="button" className="btn-text" onClick={() => { setClearOpen(false); setConfirmText('') }}>Cancel</button>
          </div>
        </form>
      )}

      <ImportDialog preview={preview} onCancel={() => setPreview(null)} onDone={onDone} />
    </section>
  )
}
