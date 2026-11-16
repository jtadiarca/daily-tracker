import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useSettings } from '../features/settings/useSettings'
import { formatTime } from '../lib/time'
import {
  MINUTE_MARKS, angleOf, from12, handFor, hourAtAngle, hourMarks, joinTime, minuteAtAngle, pad2, parseHourInput,
  parseMinuteInput, splitTime, to12,
} from '../lib/clock'

const ICON_CLOCK = 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'
const ICON_KEYBOARD = 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z'

// Dial size and where the numbers sit, in px (Material 3: a 256px dial with 48px number targets).
const DIAL = 256
const C = DIAL / 2
const R_OUTER = 100
const R_INNER = 64
const KNOB = 24

type Mode = 'hour' | 'minute'

const at = (angle: number, r: number) => {
  const rad = (angle * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

/** A sensible starting time for an empty field: now, rounded up to the next 5 minutes. */
function startTime(): { h: number; m: number } {
  const d = new Date()
  const total = Math.ceil((d.getHours() * 60 + d.getMinutes()) / 5) * 5 % (24 * 60)
  return { h: Math.floor(total / 60), m: total % 60 }
}

/**
 * Material 3 time picker: an outlined field that opens a dialog with a clock dial.
 * Pick the hour on the dial, then the minute (it switches by itself), or press the keyboard button to
 * type the time instead. Follows the 12- or 24-hour setting.
 * Keyboard on the dial: arrows change the value (Page Up/Down: 5 minutes), Enter moves on or confirms.
 */
export function TimePicker({ label, value, onChange, required, className = '' }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; className?: string
}) {
  const id = useId()
  const { timeFormat } = useSettings()
  const is24 = timeFormat === '24h'
  const field = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const dial = useRef<HTMLDivElement>(null)
  const hourInput = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)

  const [open, setOpen] = useState(false)
  const [h, setH] = useState(0)
  const [m, setM] = useState(0)
  const [mode, setMode] = useState<Mode>('hour')
  const [typing, setTyping] = useState(false)
  const [hourText, setHourText] = useState('')
  const [minuteText, setMinuteText] = useState('')

  const { hour: h12, pm } = to12(h)
  const shownHour = is24 ? h : h12

  const show = () => {
    const t = splitTime(value) ?? startTime()
    setH(t.h); setM(t.m); setMode('hour'); setTyping(false); setOpen(true)
  }
  const close = () => { setOpen(false); field.current?.focus() }

  // Typed values, checked; null when the box holds something that isn't a valid hour or minute.
  const typedHour = parseHourInput(hourText, is24)
  const typedMinute = parseMinuteInput(minuteText)
  const typedOk = typedHour != null && typedMinute != null
  const confirm = () => {
    if (typing) {
      if (!typedOk) return
      onChange(joinTime(is24 ? typedHour : from12(typedHour, pm), typedMinute))
    } else onChange(joinTime(h, m))
    close()
  }

  const startTyping = () => { setHourText(pad2(shownHour)); setMinuteText(pad2(m)); setTyping(true) }
  const stopTyping = () => {
    if (typedHour != null) setH(is24 ? typedHour : from12(typedHour, pm))
    if (typedMinute != null) setM(typedMinute)
    setTyping(false)
  }
  const setPm = (next: boolean) => setH(cur => from12(to12(cur).hour, next))

  // Focus the picker (or the hour box when typing). Tab reaches the dial, where the arrow keys work.
  useEffect(() => {
    if (!open) return
    if (typing) { hourInput.current?.focus(); hourInput.current?.select() } else box.current?.focus()
  }, [open, typing])

  const pickAt = (e: PointerEvent, snap: boolean) => {
    const r = dial.current!.getBoundingClientRect()
    const dx = e.clientX - r.left - C, dy = e.clientY - r.top - C
    const angle = angleOf(dx, dy)
    if (mode === 'hour') setH(hourAtAngle(angle, is24, Math.hypot(dx, dy) < (R_OUTER + R_INNER) / 2, pm))
    else setM(minuteAtAngle(angle, snap))
  }
  const onDown = (e: PointerEvent) => { dragging.current = true; dial.current?.setPointerCapture(e.pointerId); pickAt(e, true) }
  const onMove = (e: PointerEvent) => { if (dragging.current) pickAt(e, false) }
  const onUp = () => { if (!dragging.current) return; dragging.current = false; if (mode === 'hour') setMode('minute') }

  const onDialKey = (e: KeyboardEvent) => {
    const step = (n: number) => {
      e.preventDefault()
      if (mode === 'hour') setH(cur => is24 ? (cur + n + 24) % 24 : from12(((to12(cur).hour % 12) + n + 12) % 12 || 12, to12(cur).pm))
      else setM(cur => (cur + n + 60) % 60)
    }
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': return step(1)
      case 'ArrowDown': case 'ArrowLeft': return step(-1)
      case 'PageUp': return step(mode === 'minute' ? 5 : 3)
      case 'PageDown': return step(mode === 'minute' ? -5 : -3)
      case 'Enter': e.preventDefault(); return mode === 'hour' ? setMode('minute') : confirm()
    }
  }

  // Escape closes only this picker, not the task dialog around it; Tab stays inside the picker.
  const onBoxKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return }
    if (e.key !== 'Tab' || !box.current) return
    const items = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')]
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const hand = handFor(mode, mode === 'hour' ? h : m, is24)
  const knob = at(hand.angle, hand.inner ? R_INNER : R_OUTER)
  const marks = mode === 'hour'
    ? hourMarks(is24).map(k => ({ ...k, selected: k.value === shownHour, angle: (k.value % 12) * 30 }))
    : MINUTE_MARKS.map(v => ({ value: v, inner: false, label: pad2(v), selected: v === m, angle: v * 6 }))

  const numBox = (which: Mode, text: string) => {
    const active = mode === which
    return (
      <button type="button" aria-pressed={active} aria-label={`${which === 'hour' ? 'Hour' : 'Minute'} ${text}`} onClick={() => setMode(which)}
        className={`flex h-20 w-24 items-center justify-center rounded-m3-sm text-[45px] leading-none tabular-nums transition ${active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface hover:brightness-95'}`}>
        {text}
      </button>
    )
  }
  const numInput = (which: Mode) => {
    const isHour = which === 'hour'
    const text = isHour ? hourText : minuteText
    const bad = text !== '' && (isHour ? typedHour : typedMinute) == null
    return (
      <label className="flex flex-col gap-1">
        <input ref={isHour ? hourInput : undefined} inputMode="numeric" maxLength={2} value={text} aria-invalid={bad}
          aria-label={isHour ? (is24 ? 'Hour, 0 to 23' : 'Hour, 1 to 12') : 'Minute, 0 to 59'}
          onChange={e => (isHour ? setHourText : setMinuteText)(e.target.value.replace(/\D/g, ''))}
          onFocus={e => e.target.select()}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm() } }}
          className={`h-20 w-24 rounded-m3-sm bg-surface-container-highest text-center text-[45px] leading-none tabular-nums text-on-surface outline-none focus:bg-primary-container focus:text-on-primary-container focus:ring-2 ${bad ? 'ring-2 ring-error focus:ring-error' : 'focus:ring-primary'}`} />
        <span className={`text-xs ${bad ? 'text-error' : 'text-on-surface-variant'}`}>{isHour ? 'Hour' : 'Minute'}</span>
      </label>
    )
  }
  const amPm = (
    <div role="group" aria-label="AM or PM" className="flex h-20 w-[52px] flex-col overflow-hidden rounded-m3-sm border border-outline text-sm font-medium">
      {[false, true].map(isPm => (
        <button key={String(isPm)} type="button" aria-pressed={pm === isPm} onClick={() => setPm(isPm)}
          className={`flex-1 ${isPm ? 'border-t border-outline' : ''} ${pm === isPm ? 'bg-tertiary-container text-on-tertiary-container' : 'text-on-surface-variant hover:bg-on-surface/10'}`}>
          {isPm ? 'PM' : 'AM'}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`relative ${className}`}>
      <span id={`${id}-label`} className="field-label">{label}</span>
      <button ref={field} type="button" id={`${id}-field`} aria-haspopup="dialog" aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-field`} onClick={show}
        className={`field mt-1 flex items-center gap-2 text-left ${open ? 'border-primary ring-1 ring-primary' : ''}`}>
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-on-surface-variant'}`}>{value ? formatTime(value, timeFormat) : 'Choose a time'}</span>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="-mr-1 shrink-0 fill-on-surface-variant"><path d={ICON_CLOCK} /></svg>
      </button>
      {/* Lets the browser's own "please fill in this field" check work for a required time. */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}

      {open && (
        // Rendered in place (not in a portal) so it works inside the task dialog; position: fixed covers the window.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4" onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
          <div ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onKeyDown={onBoxKey}
            className="max-h-full w-full max-w-[328px] overflow-y-auto outline-none rounded-m3-xl bg-surface-container-high p-6 text-on-surface shadow-m3-3">
            <p id={`${id}-title`} className="mb-5 text-xs font-medium text-on-surface-variant">{typing ? 'Enter time' : 'Select time'}</p>

            <div className="flex items-start justify-center gap-3">
              <div className="flex items-start gap-1">
                {typing ? numInput('hour') : numBox('hour', is24 ? pad2(h) : String(h12))}
                <span aria-hidden="true" className="flex h-20 w-6 items-center justify-center text-[45px] leading-none">:</span>
                {typing ? numInput('minute') : numBox('minute', pad2(m))}
              </div>
              {!is24 && amPm}
            </div>

            {!typing && (
              <div ref={dial} role="slider" tabIndex={0} aria-label={mode === 'hour' ? 'Hour' : 'Minute'}
                aria-valuemin={mode === 'hour' ? (is24 ? 0 : 1) : 0} aria-valuemax={mode === 'hour' ? (is24 ? 23 : 12) : 59}
                aria-valuenow={mode === 'hour' ? shownHour : m} aria-valuetext={mode === 'hour' ? formatTime(joinTime(h, 0), timeFormat).replace(':00', '') : `${m} minutes`}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onDialKey}
                className="relative mx-auto mt-9 touch-none select-none rounded-full bg-surface-container-highest outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface-container-high"
                style={{ width: DIAL, height: DIAL }}>
                <svg width={DIAL} height={DIAL} className="absolute inset-0" aria-hidden="true">
                  <line x1={C} y1={C} x2={knob.x} y2={knob.y} strokeWidth={2} className="stroke-primary" />
                  <circle cx={C} cy={C} r={4} className="fill-primary" />
                  <circle cx={knob.x} cy={knob.y} r={KNOB} className="fill-primary" />
                  {/* Minutes between the labeled 5s show a small dot in the knob, as in Material 3. */}
                  {mode === 'minute' && m % 5 !== 0 && <circle cx={knob.x} cy={knob.y} r={3} className="fill-on-primary" />}
                </svg>
                {marks.map(k => {
                  const p = at(k.angle, k.inner ? R_INNER : R_OUTER)
                  return (
                    <span key={`${k.inner}-${k.value}`} aria-hidden="true"
                      className={`pointer-events-none absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${k.inner ? 'text-sm' : 'text-base'} ${k.selected ? 'text-on-primary' : k.inner ? 'text-on-surface-variant' : 'text-on-surface'}`}
                      style={{ left: p.x, top: p.y }}>
                      {k.label}
                    </span>
                  )
                })}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" aria-label={typing ? 'Switch to clock' : 'Switch to typing the time'} title={typing ? 'Use the clock' : 'Type the time'}
                onClick={() => (typing ? stopTyping() : startTyping())}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/10">
                <svg viewBox="0 0 24 24" width="24" height="24" className="fill-current" aria-hidden="true"><path d={typing ? ICON_CLOCK : ICON_KEYBOARD} /></svg>
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn-text" onClick={close}>Cancel</button>
                <button type="button" className="btn-text" disabled={typing && !typedOk} onClick={confirm}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
