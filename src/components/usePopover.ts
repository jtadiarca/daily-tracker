import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

const GAP = 4 // space between the field and the menu, in px
const EDGE = 8 // closest the menu gets to the window edge, in px

/**
 * Places a menu or picker next to its field with position: fixed, so it isn't clipped by a scrolling
 * card or the task dialog. It opens below the field, or above when there is more room there, and is
 * kept inside the window. It closes on a click outside, and follows the field when the page scrolls.
 *
 * The popup is rendered in place (not in a portal) so it stays inside an open <dialog>, which would
 * otherwise make everything outside it unclickable.
 */
export function usePopover(anchor: RefObject<HTMLElement>, opts: { width?: number; matchWidth?: boolean } = {}) {
  const [open, setOpen] = useState(false)
  const popup = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' })

  const place = useCallback(() => {
    const a = anchor.current, p = popup.current
    if (!a || !p) return
    const r = a.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const width = Math.min(opts.matchWidth ? r.width : opts.width ?? r.width, vw - EDGE * 2)
    const natural = p.scrollHeight
    const below = vh - r.bottom - GAP - EDGE
    const above = r.top - GAP - EDGE
    const up = natural > below && above > below
    const maxHeight = Math.max(120, up ? above : below)
    const height = Math.min(natural, maxHeight)
    const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE)
    const top = up ? Math.max(EDGE, r.top - GAP - height) : Math.min(r.bottom + GAP, vh - EDGE - height)
    setStyle({ position: 'fixed', top, left, width, maxHeight, visibility: 'visible' })
  }, [anchor, opts.width, opts.matchWidth])

  useLayoutEffect(() => {
    if (!open) { setStyle({ position: 'fixed', visibility: 'hidden' }); return }
    place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popup.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false)
    }
    const follow = () => place()
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', follow, true)
    }
  }, [open, place, anchor])

  return { open, setOpen, popup, style, place }
}
