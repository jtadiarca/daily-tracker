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
  return <dialog ref={ref} aria-labelledby="delete-heading" onCancel={e => { e.preventDefault(); onClose() }} className="w-[90%] max-w-sm rounded-xl bg-white p-4 text-slate-900 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
    <h2 id="delete-heading" className="mb-3 text-lg font-semibold">Delete {task?.title}?</h2><p className="mb-3">This is a repeating task.</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-col gap-2"><button className="rounded border p-2" onClick={() => task && void run(() => skipOccurrence(task.id, date))}>This one only</button>
    <button className="rounded border p-2" onClick={() => task && void run(() => endSeriesFrom(task.id, date))}>All future (including this date)</button>
    <button className="rounded border p-2" onClick={onClose}>Cancel</button></div>
  </dialog>
}
