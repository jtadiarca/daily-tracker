import { describe, it, expect } from 'vitest'
import { DEFAULT_THEME, parseColorMode, parseThemePref, resolveMode, ROLES, schemeHex, THEME_PRESETS, themeCss } from './theme'

// WCAG relative luminance and contrast ratio.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('schemeHex', () => {
  it('gives every role a hex color', () => {
    const s = schemeHex('#0B57D0', false)
    for (const r of ROLES) expect(s[r]).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('makes light surfaces in light mode and dark surfaces in dark mode', () => {
    expect(lum(schemeHex('#386A20', false).surface)).toBeGreaterThan(0.8)
    expect(lum(schemeHex('#386A20', true).surface)).toBeLessThan(0.05)
  })
  it('keeps text readable for every preset in both modes (at least 4.5:1)', () => {
    for (const p of THEME_PRESETS) for (const dark of [false, true]) {
      const s = schemeHex(p.seed, dark)
      expect(contrast(s['on-primary'], s.primary), `${p.name} ${dark}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(s['on-surface'], s.surface), `${p.name} ${dark}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(s['on-primary-container'], s['primary-container']), `${p.name} ${dark}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('themeCss', () => {
  it('is empty for the baseline theme or a bad color', () => {
    expect(themeCss(null)).toBe('')
    expect(themeCss('red')).toBe('')
  })
  it('overrides every role for light and dark', () => {
    const css = themeCss('#006A6A')
    expect(css).toContain(":root:root[data-mode='dark']")
    expect(css.match(/--md-primary:/g)).toHaveLength(2)
    expect(css).toMatch(/--md-surface: \d+ \d+ \d+;/)
  })
})

describe('parseThemePref', () => {
  it('defaults to baseline', () => {
    expect(parseThemePref(null)).toEqual(DEFAULT_THEME)
    expect(parseThemePref('{bad')).toEqual(DEFAULT_THEME)
    expect(parseThemePref(JSON.stringify({ id: 'nope' }))).toEqual(DEFAULT_THEME)
    expect(parseThemePref(JSON.stringify({ id: 'custom', seed: 'blue' }))).toEqual(DEFAULT_THEME)
  })
  it('uses the preset seed, ignoring any saved seed for a preset', () => {
    expect(parseThemePref(JSON.stringify({ id: 'teal', seed: '#ffffff' }))).toEqual({ id: 'teal', seed: '#006A6A' })
  })
  it('keeps a custom color', () => {
    expect(parseThemePref(JSON.stringify({ id: 'custom', seed: '#ABCDEF' }))).toEqual({ id: 'custom', seed: '#abcdef' })
  })
})

describe('color mode', () => {
  it('defaults to system and accepts light and dark', () => {
    expect(parseColorMode(null)).toBe('system')
    expect(parseColorMode('bogus')).toBe('system')
    expect(parseColorMode('light')).toBe('light')
    expect(parseColorMode('dark')).toBe('dark')
  })
  it('follows the device only in system mode', () => {
    expect(resolveMode('system', true)).toBe('dark')
    expect(resolveMode('system', false)).toBe('light')
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('dark', false)).toBe('dark')
  })
})
