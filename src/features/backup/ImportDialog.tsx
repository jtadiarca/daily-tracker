import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { applyImport, type ImportMode, type ImportPreview, type ImportResult } from '../../db/backup'
import { unchangedCount } from '../../lib/merge'

export function ImportDialog({ preview, onCancel, onDone }: {
  preview: ImportPreview | null; onCancel: () => void; onDone: (r: ImportResult) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (preview && !d.open) { setMode('merge'); setError(''); d.showModal() }
    if (!preview && d.open) d.close()
  }, [preview])

  const apply = async () => {
    if (!preview || busy) return
    if (mode === 'replace' && !window.confirm('Replace everything? All tasks, history and settings on this device will be deleted and replaced by the file. You can undo this until you next open the app.')) return
    setBusy(true); setError('')
    try {
      onDone(await applyImport(preview, mode))
    } catch (e) {
      setError(`The import failed and nothing was changed. ${e instanceof Error ? e.message : ''}`)
    } finally { setBusy(false) }
  }

  const c = preview?.counts
  const m = preview?.merge
  return (
    <dialog ref={ref} aria-labelledby="import-h" onCancel={e => { e.preventDefault(); if (!busy) onCancel() }} className="m3-dialog w-[92%] max-w-md">
      {preview && c && m && (
        <div className="space-y-4">
          <h2 id="import-h" className="text-2xl">Import backup</h2>
          <p className="text-on-surface-variant">
            {c.tasks} tasks, {c.completions} completions{c.deletions ? `, ${c.deletions} deletions` : ''}, exported on{' '}
            {format(new Date(preview.exportedAt), 'PPP p')} from {preview.fromOtherDevice ? 'another device' : 'this device'}.
          </p>
          <fieldset className="space-y-1">
            <legend className="mb-1 font-medium">How to import</legend>
            <label className="flex min-h-[44px] items-center gap-3"><input type="radio" name="mode" className="h-5 w-5" checked={mode === 'merge'} onChange={() => setMode('merge')} />Merge with what is on this device (recommended)</label>
            <label className="flex min-h-[44px] items-center gap-3"><input type="radio" name="mode" className="h-5 w-5" checked={mode === 'replace'} onChange={() => setMode('replace')} />Replace everything on this device</label>
          </fieldset>
          {mode === 'merge' ? (
            <div className="space-y-1 text-sm">
              <p><strong>{m.added} new, {m.updated} updated, {unchangedCount(m)} unchanged.</strong></p>
              {m.updated > 0 && <p className="text-on-surface-variant">Updated items were edited more recently in the file than on this device, so the file's version wins.</p>}
              {m.keptLocalNewer > 0 && <p className="text-on-surface-variant">{m.keptLocalNewer} items were edited more recently on this device, so your versions are kept.</p>}
              {m.skippedFuture > 0 && <p role="alert" className="rounded-m3-sm bg-tertiary-container p-2 text-on-tertiary-container">{m.skippedFuture} items were ignored because their timestamps are more than 24 hours in the future (a device clock may be wrong).</p>}
            </div>
          ) : (
            <p role="alert" className="rounded-m3-sm bg-error-container p-3 text-sm text-on-error-container">This deletes {preview.replace.removingTasks} tasks and {preview.replace.removingCompletions} completions here and loads {c.tasks} tasks and {c.completions} completions from the file.</p>
          )}
          {error && <p role="alert" className="text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-text" disabled={busy} onClick={onCancel}>Cancel</button>
            <button className={mode === 'replace' ? 'btn-filled-error' : 'btn-filled'} disabled={busy} onClick={() => void apply()}>
              {busy ? 'Importing…' : mode === 'replace' ? 'Replace everything' : 'Merge'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
