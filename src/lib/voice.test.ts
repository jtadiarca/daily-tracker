import { describe, it, expect } from 'vitest'
import { DEFAULT_VOICE_PREFS, findVoice, parseVoicePrefs, pitchLabel, sortVoices, speedLabel } from './voice'

const v = (voiceURI: string, name: string, lang: string) => ({ voiceURI, name, lang })

describe('parseVoicePrefs', () => {
  it('falls back to defaults for nothing or bad JSON', () => {
    expect(parseVoicePrefs(null)).toEqual(DEFAULT_VOICE_PREFS)
    expect(parseVoicePrefs('{oops')).toEqual(DEFAULT_VOICE_PREFS)
    expect(parseVoicePrefs('null')).toEqual(DEFAULT_VOICE_PREFS)
  })
  it('keeps valid values', () => {
    expect(parseVoicePrefs(JSON.stringify({ enabled: false, voiceURI: 'x', rate: 1.5, pitch: 0.8 })))
      .toEqual({ enabled: false, voiceURI: 'x', rate: 1.5, pitch: 0.8 })
  })
  it('clamps and rounds speed and pitch, and ignores wrong types', () => {
    expect(parseVoicePrefs(JSON.stringify({ rate: 9, pitch: -3 }))).toMatchObject({ rate: 2, pitch: 0 })
    expect(parseVoicePrefs(JSON.stringify({ rate: 1.234 })).rate).toBe(1.2)
    expect(parseVoicePrefs(JSON.stringify({ enabled: 'yes', voiceURI: 5, rate: 'fast' }))).toEqual(DEFAULT_VOICE_PREFS)
  })
})

describe('voices', () => {
  const voices = [v('b', 'Zed', 'fr-FR'), v('a', 'Mark', 'en-US'), v('c', 'Aria', 'en-US'), v('d', 'Libby', 'en-GB')]
  it('finds a saved voice, or null when it is gone', () => {
    expect(findVoice(voices, 'c')?.name).toBe('Aria')
    expect(findVoice(voices, 'missing')).toBeNull()
    expect(findVoice(voices, null)).toBeNull()
  })
  it('lists English voices first, by language then name', () => {
    expect(sortVoices(voices).map(x => x.name)).toEqual(['Libby', 'Aria', 'Mark', 'Zed'])
  })
})

describe('labels', () => {
  it('describes speed and pitch', () => {
    expect(speedLabel(1)).toBe('Normal')
    expect(speedLabel(1.5)).toBe('1.5×')
    expect(pitchLabel(1)).toBe('Normal')
    expect(pitchLabel(0.5)).toBe('Lower (0.5)')
    expect(pitchLabel(1.4)).toBe('Higher (1.4)')
  })
})
