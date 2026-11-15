import { useEffect, useState } from 'react'
import { parseVoicePrefs, sortVoices, type VoicePrefs } from '../../lib/voice'

// Per-device setting (each device has different voices), so it lives in localStorage, not the database or backups.
const KEY = 'dtt.voicePrefs'
const EVENT = 'app:voice-prefs'

export function getVoicePrefs(): VoicePrefs {
  try { return parseVoicePrefs(localStorage.getItem(KEY)) } catch { return parseVoicePrefs(null) }
}

export function setVoicePrefs(patch: Partial<VoicePrefs>): VoicePrefs {
  const next = { ...getVoicePrefs(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable: applies until reload */ }
  window.dispatchEvent(new Event(EVENT))
  return next
}

export function useVoicePrefs(): VoicePrefs {
  const [prefs, setPrefs] = useState(getVoicePrefs)
  useEffect(() => {
    const h = () => setPrefs(getVoicePrefs())
    window.addEventListener(EVENT, h)
    window.addEventListener('storage', h) // another tab changed it
    return () => { window.removeEventListener(EVENT, h); window.removeEventListener('storage', h) }
  }, [])
  return prefs
}

// The voices this browser offers. Chrome loads them a moment after the page, so listen for voiceschanged.
export function useVoices(): SpeechSynthesisVoice[] {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (synth ? sortVoices(synth.getVoices()) : []))
  useEffect(() => {
    if (!synth) return
    const h = () => setVoices(sortVoices(synth.getVoices()))
    h()
    synth.addEventListener('voiceschanged', h)
    return () => synth.removeEventListener('voiceschanged', h)
  }, [synth])
  return voices
}
