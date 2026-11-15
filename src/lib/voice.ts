// Spoken reminder preferences. They are kept per device (in localStorage), never in backups,
// because each device and browser offers its own set of voices.

export interface VoicePrefs {
  enabled: boolean
  voiceURI: string | null // null = the browser's default voice
  rate: number            // speed, 0.5 to 2 (1 = normal)
  pitch: number           // 0 to 2 (1 = normal)
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = { enabled: true, voiceURI: null, rate: 1, pitch: 1 }
export const RATE_RANGE = { min: 0.5, max: 2, step: 0.1 } as const
export const PITCH_RANGE = { min: 0, max: 2, step: 0.1 } as const

// Each reminder is read this many times so it is hard to miss.
export const REMINDER_REPEATS = 3

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : fallback

// Reads saved preferences, ignoring anything missing or malformed.
export function parseVoicePrefs(raw: string | null): VoicePrefs {
  if (!raw) return { ...DEFAULT_VOICE_PREFS }
  let v: Partial<Record<keyof VoicePrefs, unknown>>
  try { v = JSON.parse(raw) ?? {} } catch { return { ...DEFAULT_VOICE_PREFS } }
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_VOICE_PREFS.enabled,
    voiceURI: typeof v.voiceURI === 'string' && v.voiceURI ? v.voiceURI : null,
    rate: clamp(v.rate, RATE_RANGE.min, RATE_RANGE.max, DEFAULT_VOICE_PREFS.rate),
    pitch: clamp(v.pitch, PITCH_RANGE.min, PITCH_RANGE.max, DEFAULT_VOICE_PREFS.pitch),
  }
}

type VoiceLike = { voiceURI: string; name: string; lang: string; default?: boolean }

// The chosen voice if this device still has it, otherwise null (the browser default is used).
export const findVoice = <V extends VoiceLike>(voices: V[], uri: string | null): V | null =>
  (uri ? voices.find(v => v.voiceURI === uri) : undefined) ?? null

// Voices for the picker: the app's language first (English), then the rest, each group by name.
export function sortVoices<V extends VoiceLike>(voices: V[], lang = 'en'): V[] {
  const base = lang.toLowerCase().split('-')[0]
  const rank = (v: V) => (v.lang.toLowerCase().startsWith(base) ? 0 : 1)
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
}

export const speedLabel = (rate: number) => (rate === 1 ? 'Normal' : `${rate.toFixed(1)}×`)
export const pitchLabel = (pitch: number) => (pitch === 1 ? 'Normal' : pitch < 1 ? `Lower (${pitch.toFixed(1)})` : `Higher (${pitch.toFixed(1)})`)
