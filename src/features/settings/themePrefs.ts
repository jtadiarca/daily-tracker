import { useEffect, useState } from 'react'
import { parseColorMode, parseThemePref, resolveMode, schemeHex, themeCss, type ColorMode, type ThemePref } from '../../lib/theme'

// Color theme and light/dark mode are per-device look-and-feel choices, kept in localStorage and not in backups.
const KEY = 'dtt.theme'
const MODE_KEY = 'dtt.colorMode' // also read by the early script in index.html
const EVENT = 'app:theme'
const STYLE_ID = 'dtt-theme'
const BASELINE_SURFACE = { light: '#FEF7FF', dark: '#141218' }

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage unavailable: applies until reload */ } }

export const getThemePref = (): ThemePref => parseThemePref(read(KEY))
export const getColorMode = (): ColorMode => parseColorMode(read(MODE_KEY))

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

// Writes the theme's colors and the light/dark mark into the page, and updates the browser's title-bar color.
// Called once before the app first renders (so the default colors never flash) and on every change.
export function applyTheme(pref: ThemePref = getThemePref(), mode: ColorMode = getColorMode()) {
  const effective = resolveMode(mode, systemQuery().matches)
  document.documentElement.dataset.mode = effective

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = themeCss(pref.seed)

  const surface = (dark: boolean) => (pref.seed ? schemeHex(pref.seed, dark).surface : BASELINE_SURFACE[dark ? 'dark' : 'light'])
  // index.html has one theme-color tag for light and one for dark. When the mode is forced, both use it.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
    const forDark = mode === 'system' ? m.media.includes('dark') : effective === 'dark'
    m.content = surface(forDark)
  })
}

export function setThemePref(pref: ThemePref) {
  write(KEY, JSON.stringify(pref))
  applyTheme(pref)
  window.dispatchEvent(new Event(EVENT))
}

export function setColorMode(mode: ColorMode) {
  write(MODE_KEY, mode)
  applyTheme(undefined, mode)
  window.dispatchEvent(new Event(EVENT))
}

// In System mode, follow the device when it switches between light and dark (for example at sunset).
let watching = false
export function watchSystemMode() {
  if (watching) return
  watching = true
  systemQuery().addEventListener('change', () => { if (getColorMode() === 'system') applyTheme() })
}

export function useAppearance(): { theme: ThemePref; mode: ColorMode } {
  const get = () => ({ theme: getThemePref(), mode: getColorMode() })
  const [state, setState] = useState(get)
  useEffect(() => {
    const h = () => setState(get())
    const fromOtherTab = (e: StorageEvent) => { if (e.key === KEY || e.key === MODE_KEY) { applyTheme(); h() } }
    window.addEventListener(EVENT, h)
    window.addEventListener('storage', fromOtherTab)
    return () => { window.removeEventListener(EVENT, h); window.removeEventListener('storage', fromOtherTab) }
  }, [])
  return state
}
