import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { usePopover } from './usePopover'

export type SelectOption = { value: string; label: string }

const ARROW = 'M7 10l5 5 5-5z'
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'

/**
 * Material 3 "exposed dropdown menu": an outlined field that opens a menu of choices.
 * Works with the keyboard like a native select: Enter, Space or the arrow keys open it, arrows and
 * Home/End move, typing a letter jumps to a match, Enter or Space picks, Escape or Tab closes.
 */
export function Select({ label, value, options, onChange, className = '', disabled }: {
  label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; className?: string; disabled?: boolean
}) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const { open, setOpen, popup, style } = usePopover(button, { matchWidth: true })
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))
  const [active, setActive] = useState(selectedIndex)
  const typed = useRef({ text: '', at: 0 })
  const current = options.find(o => o.value === value)

  const show = (index = selectedIndex) => { setActive(index); setOpen(true) }
  const close = (focusField = true) => { setOpen(false); if (focusField) button.current?.focus() }
  const pick = (index: number) => { const o = options[index]; if (o && o.value !== value) onChange(o.value); close() }

  // Move focus into the menu when it opens, and keep the active choice scrolled into view.
  useEffect(() => { if (open) list.current?.focus() }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const typeahead = (key: string) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at < 700 ? t.text + key.toLowerCase() : key.toLowerCase()
    t.at = now
    const start = t.text.length === 1 ? active + 1 : active
    for (let i = 0; i < options.length; i++) {
      const j = (start + i) % options.length
      if (options[j].label.toLowerCase().startsWith(t.text)) return j
    }
    return -1
  }

  const onFieldKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
  }
  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1
    const move = (i: number) => { e.preventDefault(); setActive(Math.min(last, Math.max(0, i))) }
    switch (e.key) {
      case 'ArrowDown': return move(active + 1)
      case 'ArrowUp': return move(active - 1)
      case 'Home': return move(0)
      case 'End': return move(last)
      case 'PageDown': return move(active + 8)
      case 'PageUp': return move(active - 8)
      case 'Enter': case ' ': e.preventDefault(); return pick(active)
      // Stop Escape here so it closes only the menu, not the task dialog around it.
      case 'Escape': e.preventDefault(); e.stopPropagation(); return close()
      case 'Tab': return close(false)
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const j = typeahead(e.key)
          if (j >= 0) move(j)
        }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <span id={`${id}-label`} className="field-label">{label}</span>
      <button ref={button} type="button" id={`${id}-field`} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-field`}
        onClick={() => (open ? close() : show())} onKeyDown={onFieldKey}
        className={`field mt-1 flex items-center gap-2 text-left disabled:cursor-not-allowed ${open ? 'border-primary ring-1 ring-primary' : ''}`}>
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ''}</span>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"
          className={`-mr-2 shrink-0 fill-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}><path d={ARROW} /></svg>
      </button>
      {open && (
        <div ref={popup} style={style} className="z-50 overflow-y-auto rounded-m3-xs bg-surface-container py-2 shadow-m3-2">
          <ul ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-labelledby={`${id}-label`}
            aria-activedescendant={`${id}-opt-${active}`} onKeyDown={onListKey} className="outline-none">
            {options.map((o, i) => {
              const selected = o.value === value
              return (
                <li key={o.value} id={`${id}-opt-${i}`} data-index={i} role="option" aria-selected={selected}
                  onPointerEnter={() => setActive(i)} onClick={() => pick(i)}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 px-3 text-base ${selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'} ${i === active ? (selected ? 'brightness-95' : 'bg-on-surface/10') : ''}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={`shrink-0 fill-current ${selected ? '' : 'invisible'}`}><path d={CHECK} /></svg>
                  <span className="min-w-0 flex-1">{o.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
