import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { createCategory, deleteCategory, renameCategory } from '../../db/categoryRepo'
import { countByCategory, MAX_CATEGORY_NAME } from '../../lib/categories'
import { useCategories } from './useCategories'

// Settings section where categories are created, renamed and deleted.
export function CategoryManager() {
  const categories = useCategories()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const counts = countByCategory(tasks ?? [], categories)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const run = async (work: () => Promise<unknown>) => {
    try { await work(); setError(''); return true } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); return false }
  }
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await run(() => createCategory(name))) setName('')
  }
  const saveRename = async (id: string) => {
    if (await run(() => renameCategory(id, draft))) setEditing(null)
  }
  const remove = (id: string, label: string) => {
    const n = counts.get(id) ?? 0
    const detail = n === 0 ? '' : ` Its ${n} ${n === 1 ? 'task' : 'tasks'} will become uncategorized.`
    if (window.confirm(`Delete the category “${label}”?${detail}`)) void run(() => deleteCategory(id))
  }

  return (
    <section aria-labelledby="cat-h" className="card">
      <h2 id="cat-h" className="mb-1 text-xl">Categories</h2>
      <p className="mb-3 text-sm text-on-surface-variant">Create your own categories to group tasks on Today and Upcoming and to break down the Dashboard. Deleting one keeps its tasks.</p>
      {categories.length === 0 && <p className="mb-3 text-on-surface-variant">No categories yet.</p>}
      <ul className="mb-3 space-y-2">
        {categories.map(c => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            {editing === c.id ? (
              <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); void saveRename(c.id) }}>
                <label className="sr-only" htmlFor={`rename-${c.id}`}>New name for {c.name}</label>
                <input id={`rename-${c.id}`} autoFocus value={draft} maxLength={MAX_CATEGORY_NAME} onChange={e => setDraft(e.target.value)} className="field min-w-0 flex-1" />
                <button type="submit" className="btn-tonal">Save</button>
                <button type="button" className="btn-text" onClick={() => { setEditing(null); setError('') }}>Cancel</button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 break-words">{c.name}<span className="ml-2 text-sm text-on-surface-variant">{counts.get(c.id) ?? 0} {(counts.get(c.id) ?? 0) === 1 ? 'task' : 'tasks'}</span></span>
                <button type="button" className="btn-text" aria-label={`Rename ${c.name}`} onClick={() => { setEditing(c.id); setDraft(c.name); setError('') }}>Rename</button>
                <button type="button" className="btn-text-error" aria-label={`Delete ${c.name}`} onClick={() => remove(c.id, c.name)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={e => void add(e)} className="flex flex-wrap items-end gap-2">
        <label className="field-label min-w-0 flex-1">New category
          <input value={name} maxLength={MAX_CATEGORY_NAME} onChange={e => setName(e.target.value)} placeholder="For example Work or Health" className="field mt-1" />
        </label>
        <button type="submit" className="btn-filled" disabled={!name.trim()}>Add</button>
      </form>
      {error && <p role="alert" className="mt-2 text-error">{error}</p>}
    </section>
  )
}
