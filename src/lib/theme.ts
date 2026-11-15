// Custom color themes, generated the Material 3 way: one seed color goes through Google's Material Color
// Utilities (the engine behind Material Theme Builder and Android dynamic color), which produces every color
// role for light and dark mode with accessible contrast.
import { argbFromHex, Hct, hexFromArgb, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities'

export interface ThemePreset { id: string; name: string; seed: string }

// Seeds for the built-in themes. Baseline is Material 3's own default purple and keeps the exact baseline
// values in index.css; the others are generated from their seed.
export const BASELINE_ID = 'baseline'
export const THEME_PRESETS: ThemePreset[] = [
  { id: BASELINE_ID, name: 'Baseline purple', seed: '#6750A4' },
  { id: 'blue', name: 'Blue', seed: '#0B57D0' },
  { id: 'indigo', name: 'Indigo', seed: '#4355B9' },
  { id: 'teal', name: 'Teal', seed: '#006A6A' },
  { id: 'green', name: 'Green', seed: '#386A20' },
  { id: 'olive', name: 'Olive', seed: '#6D5E0F' },
  { id: 'orange', name: 'Orange', seed: '#8B5000' },
  { id: 'red', name: 'Red', seed: '#B3261E' },
  { id: 'pink', name: 'Pink', seed: '#984061' },
]

// The color roles the app uses (CSS variable --md-<role>), matching tailwind.config.js.
export const ROLES = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'on-surface', 'on-surface-variant',
  'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest',
  'outline', 'outline-variant',
  'inverse-surface', 'inverse-on-surface', 'inverse-primary', 'scrim',
] as const
export type Role = typeof ROLES[number]

const camel = (role: string) => role.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
// In this library version each role is a method on the instance that returns its DynamicColor.
const colors = new MaterialDynamicColors() as unknown as Record<string, () => { getArgb: (s: SchemeTonalSpot) => number }>

export const isHexColor = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)

// Every role as a hex color, for one seed in light or dark mode.
export function schemeHex(seed: string, dark: boolean): Record<Role, string> {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0)
  return Object.fromEntries(ROLES.map(r => [r, hexFromArgb(colors[camel(r)].call(colors).getArgb(scheme))])) as Record<Role, string>
}

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ')
const block = (vars: Record<Role, string>) => ROLES.map(r => `--md-${r}: ${channels(vars[r])};`).join(' ')

// CSS that overrides the baseline colors in index.css, or '' for the baseline theme. The doubled `:root`
// outranks the rules in index.css no matter which stylesheet loads last. Dark colors apply when <html> has
// data-mode="dark" (set from the Appearance setting).
export function themeCss(seed: string | null): string {
  if (!seed || !isHexColor(seed)) return ''
  return `:root:root { ${block(schemeHex(seed, false))} }\n` +
    `:root:root[data-mode='dark'] { ${block(schemeHex(seed, true))} }`
}

// Light, dark, or follow the device ('system', the default).
export type ColorMode = 'system' | 'light' | 'dark'
export const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark']
export const parseColorMode = (raw: string | null): ColorMode => (raw === 'light' || raw === 'dark' ? raw : 'system')
export const resolveMode = (mode: ColorMode, systemDark: boolean): 'light' | 'dark' =>
  mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

// The saved choice: a preset id, or 'custom' with its own color. Anything unreadable means baseline.
export interface ThemePref { id: string; seed: string | null }
export const DEFAULT_THEME: ThemePref = { id: BASELINE_ID, seed: null }

export function parseThemePref(raw: string | null): ThemePref {
  if (!raw) return DEFAULT_THEME
  try {
    const v = JSON.parse(raw) as Partial<ThemePref> | null
    const preset = THEME_PRESETS.find(p => p.id === v?.id)
    if (preset) return preset.id === BASELINE_ID ? DEFAULT_THEME : { id: preset.id, seed: preset.seed }
    if (v?.id === 'custom' && isHexColor(v.seed)) return { id: 'custom', seed: v.seed.toLowerCase() }
  } catch { /* fall through */ }
  return DEFAULT_THEME
}
