import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { parseDateStr, todayStr } from '../lib/dates'
import {
  MONTH_NAMES, WEEKDAY_NAMES, WEEKDAY_SHORT, clampDate, dateForKey, inRange, monthGrid, monthHasDays,
  shiftMonths, withMonth, withYear, yearRange,
} from '../lib/calendar'
import { usePopover } from './usePopover'

const ICON_CAL = 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z'
const ICON_PREV = 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'
const ICON_NEXT = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'
const ICON_DROP = 'M7 10l5 5 5-5z'
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const PICKER_WIDTH = 360

type View = 'days' | 'months' | 'years'

const iconBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/10 disabled:opacity-40 disabled:hover:bg-transparent'

/**
 * Material 3 docked date picker: an outlined field that opens a calendar under it.
 * The month and year buttons open lists to jump quickly; picking a day fills the field and closes.
 * Keyboard: arrows move a day or week, Home/End the week, Page Up/Down a month (Shift: a year),
 * Enter or Space picks, Escape closes.
 */
export function DatePicker({ label, value, onChange, min, max, required, className = '' }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean; className?: string
}) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const { open, setOpen, popup, style, place } = usePopover(button, { width: PICKER_WIDTH })
  const today = todayStr()
  // The day that has keyboard focus; the calendar shows its month.
  const [focus, setFocus] = useState(value || clampDate(today, min, max))
  const [view, setView] = useState<View>('days')
  const grid = useRef<HTMLDivElement>(null)
  const viewYear = Number(focus.slice(0, 4))
  const viewMonth = Number(focus.slice(5, 7)) - 1

  const show = () => { setFocus(clampDate(value || today, min, max)); setView('days'); setOpen(true) }
  const close = () => { setOpen(false); button.current?.focus() }
  const pick = (d: string) => { if (inRange(d, min, max)) { onChange(d); close() } }

  // Keep keyboard focus on the focused day while the calendar is showing.
  useEffect(() => {
    if (open && view === 'days') grid.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus()
  }, [open, view, focus])
  // The lists and the calendar have different heights, so place the popup again.
  useEffect(() => { if (open) place() }, [view, open, place])
  useEffect(() => {
    if (open && view !== 'days') popup.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [open, view, popup])

  const onGridKey = (e: KeyboardEvent) => {
    const next = dateForKey(focus, e.key, e.shiftKey)
    if (next) { e.preventDefault(); setFocus(clampDate(next, min, max)) }
  }
  const onPopupKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Close only the picker, not the task dialog around it.
      e.preventDefault(); e.stopPropagation()
      if (view !== 'days') setView('days'); else close()
    }
  }

  const prevMonth = shiftMonths(focus, -1), nextMonth = shiftMonths(focus, 1)
  const canPrev = monthHasDays(Number(prevMonth.slice(0, 4)), Number(prevMonth.slice(5, 7)) - 1, min, max)
  const canNext = monthHasDays(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)) - 1, min, max)
  const canPrevYear = monthHasDays(viewYear - 1, 11, min, max)
  const canNextYear = monthHasDays(viewYear + 1, 0, min, max)
  const jump = (d: string) => setFocus(clampDate(d, min, max))

  const menuBtn = (which: View, text: string) => (
    <button type="button" aria-expanded={view === which} onClick={() => setView(view === which ? 'days' : which)}
      className="inline-flex h-10 items-center gap-1 rounded-full pl-2 pr-1 text-sm font-medium text-on-surface-variant hover:bg-on-surface/10">
      {text}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={`fill-current transition-transform ${view === which ? 'rotate-180' : ''}`}><path d={ICON_DROP} /></svg>
    </button>
  )

  const listItem = (key: number, text: string, selected: boolean, enabled: boolean, onPick: () => void) => (
    <li key={key} role="option" aria-selected={selected} aria-disabled={!enabled}>
      <button type="button" disabled={!enabled} onClick={onPick}
        className={`flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-base disabled:opacity-40 ${selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface hover:bg-on-surface/10'}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={`shrink-0 fill-current ${selected ? '' : 'invisible'}`}><path d={CHECK} /></svg>
        {text}
      </button>
    </li>
  )

  return (
    <div className={`relative min-w-0 ${className}`}>
      <span id={`${id}-label`} className="field-label">{label}</span>
      <button ref={button} type="button" id={`${id}-field`} aria-haspopup="dialog" aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-field`} onClick={() => (open ? close() : show())}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); show() } }}
        className={`field mt-1 flex items-center gap-2 text-left ${open ? 'border-primary ring-1 ring-primary' : ''}`}>
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-on-surface-variant'}`}>
          {value ? format(parseDateStr(value), 'EEE, MMM d, yyyy') : 'Choose a date'}
        </span>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="-mr-1 shrink-0 fill-on-surface-variant"><path d={ICON_CAL} /></svg>
      </button>
      {/* Lets the browser's own "please fill in this field" check work for a required date. */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}

      {open && (
        <div ref={popup} style={style} role="dialog" aria-modal="false" aria-label={`Choose ${label.toLowerCase()}`} onKeyDown={onPopupKey}
          className="z-50 flex flex-col overflow-y-auto rounded-m3-lg bg-surface-container-high text-on-surface shadow-m3-3">
          {/* Header: month and year, each with previous and next buttons. */}
          <div className="flex items-center justify-between px-3 pt-3">
            <div className="flex items-center">
              {view === 'days' && <button type="button" className={iconBtn} disabled={!canPrev} aria-label="Previous month" onClick={() => jump(prevMonth)}><svg viewBox="0 0 24 24" width="24" height="24" className="fill-current" aria-hidden="true"><path d={ICON_PREV} /></svg></button>}
              {view !== 'years' && menuBtn('months', MONTH_NAMES[viewMonth].slice(0, 3))}
              {view === 'days' && <button type="button" className={iconBtn} disabled={!canNext} aria-label="Next month" onClick={() => jump(nextMonth)}><svg viewBox="0 0 24 24" width="24" height="24" className="fill-current" aria-hidden="true"><path d={ICON_NEXT} /></svg></button>}
            </div>
            <div className="flex items-center">
              {view === 'days' && <button type="button" className={iconBtn} disabled={!canPrevYear} aria-label="Previous year" onClick={() => jump(withYear(focus, viewYear - 1))}><svg viewBox="0 0 24 24" width="24" height="24" className="fill-current" aria-hidden="true"><path d={ICON_PREV} /></svg></button>}
              {view !== 'months' && menuBtn('years', String(viewYear))}
              {view === 'days' && <button type="button" className={iconBtn} disabled={!canNextYear} aria-label="Next year" onClick={() => jump(withYear(focus, viewYear + 1))}><svg viewBox="0 0 24 24" width="24" height="24" className="fill-current" aria-hidden="true"><path d={ICON_NEXT} /></svg></button>}
            </div>
          </div>

          {view === 'days' && (
            <div className="px-3 pb-1 pt-1">
              <p className="sr-only" aria-live="polite">{MONTH_NAMES[viewMonth]} {viewYear}</p>
              <div ref={grid} role="grid" aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`} onKeyDown={onGridKey}>
                <div role="row" className="grid grid-cols-7">
                  {WEEKDAY_SHORT.map((d, i) => <span key={i} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="flex h-10 items-center justify-center text-sm text-on-surface">{d}</span>)}
                </div>
                {monthGrid(viewYear, viewMonth).map((week, w) => (
                  <div key={w} role="row" className="grid grid-cols-7">
                    {week.map((d, i) => {
                      if (!d) return <span key={i} role="gridcell" className="h-12" />
                      const selected = d === value
                      const enabled = inRange(d, min, max)
                      const isToday = d === today
                      return (
                        <span key={i} role="gridcell" aria-selected={selected} className="flex h-12 items-center justify-center">
                          <button type="button" data-date={d} tabIndex={d === focus ? 0 : -1} disabled={!enabled}
                            aria-label={format(parseDateStr(d), 'EEEE, MMMM d, yyyy') + (isToday ? ', today' : '')}
                            aria-current={isToday ? 'date' : undefined}
                            onClick={() => pick(d)} onFocus={() => setFocus(d)}
                            className={`h-10 w-10 rounded-full text-sm tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface-container-high disabled:cursor-not-allowed disabled:opacity-40
                              ${selected ? 'bg-primary font-medium text-on-primary' : isToday ? 'border border-primary text-primary hover:bg-primary/10' : 'text-on-surface hover:bg-on-surface/10'}`}>
                            {Number(d.slice(8))}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'months' && (
            <ul role="listbox" aria-label="Month" className="max-h-[336px] overflow-y-auto border-t border-outline-variant py-2">
              {MONTH_NAMES.map((m, i) => listItem(i, m, i === viewMonth, monthHasDays(viewYear, i, min, max), () => { jump(withMonth(focus, i)); setView('days') }))}
            </ul>
          )}
          {view === 'years' && (
            <ul role="listbox" aria-label="Year" className="max-h-[336px] overflow-y-auto border-t border-outline-variant py-2">
              {yearRange(viewYear, min, max).map(y => listItem(y, String(y), y === viewYear, true, () => { jump(withYear(focus, y)); setView('days') }))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <button type="button" className="btn-text" disabled={!inRange(today, min, max)} onClick={() => pick(today)}>Today</button>
            <div className="flex gap-2">
              {!required && value && <button type="button" className="btn-text" onClick={() => { onChange(''); close() }}>Clear</button>}
              <button type="button" className="btn-text" onClick={close}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
