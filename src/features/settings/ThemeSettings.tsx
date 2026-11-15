import { useId, useMemo, useState } from 'react'
import { BASELINE_ID, COLOR_MODES, DEFAULT_THEME, isHexColor, schemeHex, THEME_PRESETS, type ColorMode } from '../../lib/theme'
import { setColorMode, setThemePref, useAppearance } from './themePrefs'

const MODE_LABEL: Record<ColorMode, string> = { system: 'System', light: 'Light', dark: 'Dark' }
const MODE_ICON: Record<ColorMode, string> = {
  system: 'M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z',
  light: 'M12 7a5 5 0 100 10 5 5 0 000-10zM2 13h2a1 1 0 000-2H2a1 1 0 000 2zm18 0h2a1 1 0 000-2h-2a1 1 0 000 2zM11 2v2a1 1 0 002 0V2a1 1 0 00-2 0zm0 18v2a1 1 0 002 0v-2a1 1 0 00-2 0zM5.99 4.58a1 1 0 00-1.41 1.41l1.06 1.06a1 1 0 001.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 00-1.41 1.41l1.06 1.06a1 1 0 001.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 00-1.41-1.41l-1.06 1.06a1 1 0 001.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 00-1.41-1.41l-1.06 1.06a1 1 0 001.41 1.41l1.06-1.06z',
  dark: 'M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
}

// The three colors a Material 3 swatch shows: primary, secondary container and tertiary.
function Swatch({ seed }: { seed: string }) {
  const s = useMemo(() => schemeHex(seed, false), [seed])
  return (
    <span aria-hidden="true" className="relative block h-12 w-12 overflow-hidden rounded-full shadow-m3-1" style={{ background: s.primary }}>
      <span className="absolute bottom-0 left-0 h-1/2 w-1/2" style={{ background: s['secondary-container'] }} />
      <span className="absolute bottom-0 right-0 h-1/2 w-1/2" style={{ background: s.tertiary }} />
    </span>
  )
}

const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'

// Settings card: pick a built-in Material 3 color theme or any color of your own.
export function ThemeSettings() {
  const { theme: pref, mode } = useAppearance()
  const id = useId()
  const [custom, setCustom] = useState(pref.id === 'custom' && pref.seed ? pref.seed : '#6750a4')

  const pickCustom = (hex: string) => {
    setCustom(hex)
    if (isHexColor(hex)) setThemePref({ id: 'custom', seed: hex.toLowerCase() })
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card">
      <h2 id={`${id}-h`} className="mb-1 text-xl">Appearance</h2>
      <p className="mb-3 text-sm text-on-surface-variant">Saved on this device only.</p>

      {/* Material 3 segmented button: light, dark, or follow the device. */}
      <div role="radiogroup" aria-label="Light or dark mode" className="mb-1 flex w-full max-w-sm overflow-hidden rounded-full border border-outline">
        {COLOR_MODES.map((m, i) => {
          const selected = mode === m
          return (
            <button key={m} type="button" role="radio" aria-checked={selected} onClick={() => setColorMode(m)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 px-3 text-sm font-medium transition ${i > 0 ? 'border-l border-outline' : ''} ${selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface hover:bg-on-surface/10'}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d={selected ? CHECK : MODE_ICON[m]} /></svg>
              {MODE_LABEL[m]}
            </button>
          )
        })}
      </div>
      <p className="mb-4 text-sm text-on-surface-variant">{mode === 'system' ? 'Follows your device’s light or dark setting.' : `Always ${mode}, whatever your device is set to.`}</p>

      <h3 className="section-title mb-1">Color</h3>
      <p className="mb-3 text-sm text-on-surface-variant">
        Pick a color and the whole app follows it, in light and dark mode, using Material 3’s color system.
      </p>
      <div role="radiogroup" aria-label="Color theme" className="flex flex-wrap gap-3">
        {THEME_PRESETS.map(p => {
          const selected = pref.id === p.id || (p.id === BASELINE_ID && pref.id === BASELINE_ID)
          return (
            <button key={p.id} type="button" role="radio" aria-checked={selected} aria-label={p.name} title={p.name}
              onClick={() => setThemePref(p.id === BASELINE_ID ? DEFAULT_THEME : { id: p.id, seed: p.seed })}
              className={`relative rounded-full p-1 ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low' : ''}`}>
              <Swatch seed={p.seed} />
              {selected && (
                <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55">
                  <svg viewBox="0 0 24 24" width="18" height="18" className="fill-white"><path d={CHECK} /></svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-sm text-on-surface-variant" aria-live="polite">
        Current: <strong className="text-on-surface">{pref.id === 'custom' ? `Custom (${pref.seed})` : THEME_PRESETS.find(p => p.id === pref.id)?.name}</strong>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3">
          <input type="color" value={custom} onChange={e => pickCustom(e.target.value)}
            className="h-12 w-12 cursor-pointer rounded-full border border-outline bg-transparent p-1" />
          <span>Choose your own color</span>
        </label>
        {pref.id !== BASELINE_ID && <button type="button" className="btn-text" onClick={() => setThemePref(DEFAULT_THEME)}>Reset to default</button>}
      </div>
      <p className="mt-2 text-sm text-on-surface-variant">Any color works: Material 3 adjusts it so text stays easy to read.</p>
    </section>
  )
}
