import { useEffect, useRef, useState } from 'react'
import type { Task } from '../db/types'
import { skipOccurrence, endSeriesFrom } from '../db/repo'
export function DeleteDialog({ task, date, onClose }: { task: Task | null; date: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    setError('')
    if (task && !dialog.open) dialog.showModal()
    if (!task && dialog.open) dialog.close()
  }, [task])
  const run = async (work: () => Promise<void>) => { try { await work(); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') } }
  return <dialog ref={ref} aria-labelledby="delete-heading" onCancel={e => { e.preventDefault(); onClose() }} className="m3-dialog w-[90%] max-w-sm">
    <h2 id="delete-heading" className="mb-2 text-2xl">Delete {task?.title}?</h2><p className="mb-4 text-on-surface-variant">This is a repeating task.</p>
    {error && <p role="alert" className="mb-2 text-error">{error}</p>}
    <div className="flex flex-col gap-2"><button className="btn-tonal" onClick={() => task && void run(() => skipOccurrence(task.id, date))}>This one only</button>
    <button className="btn-outlined-error" onClick={() => task && void run(() => endSeriesFrom(task.id, date))}>All future (including this date)</button>
    <button className="btn-text" onClick={onClose}>Cancel</button></div>
  </dialog>
}
