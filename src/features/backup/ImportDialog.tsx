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
    <dialog ref={ref} aria-labelledby="import-h" onCancel={e => { e.preventDefault(); if (!busy) onCancel() }}
      className="w-[92%] max-w-md rounded-xl bg-white p-4 text-slate-900 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
      {preview && c && m && (
        <div className="space-y-3">
          <h2 id="import-h" className="text-lg font-semibold">Import backup</h2>
          <p>
            {c.tasks} tasks, {c.completions} completions{c.deletions ? `, ${c.deletions} deletions` : ''}, exported on{' '}
            {format(new Date(preview.exportedAt), 'PPP p')} from {preview.fromOtherDevice ? 'another device' : 'this device'}.
          </p>
          <fieldset className="space-y-1">
            <legend className="font-semibold">How to import</legend>
            <label className="flex items-center gap-2 py-1"><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />Merge with what is on this device (recommended)</label>
            <label className="flex items-center gap-2 py-1"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />Replace everything on this device</label>
          </fieldset>
          {mode === 'merge' ? (
            <div className="space-y-1 text-sm">
              <p><strong>{m.added} new, {m.updated} updated, {unchangedCount(m)} unchanged.</strong></p>
              {m.updated > 0 && <p>Updated items were edited more recently in the file than on this device, so the file's version wins.</p>}
              {m.keptLocalNewer > 0 && <p>{m.keptLocalNewer} items were edited more recently on this device, so your versions are kept.</p>}
              {m.skippedFuture > 0 && <p role="alert">{m.skippedFuture} items were ignored because their timestamps are more than 24 hours in the future (a device clock may be wrong).</p>}
            </div>
          ) : (
            <p role="alert" className="text-sm">This deletes {preview.replace.removingTasks} tasks and {preview.replace.removingCompletions} completions here and loads {c.tasks} tasks and {c.completions} completions from the file.</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2" disabled={busy} onClick={onCancel}>Cancel</button>
            <button className={`rounded px-4 py-2 text-white ${mode === 'replace' ? 'bg-red-700' : 'bg-indigo-700'}`} disabled={busy} onClick={() => void apply()}>
              {busy ? 'Importing…' : mode === 'replace' ? 'Replace everything' : 'Merge'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
