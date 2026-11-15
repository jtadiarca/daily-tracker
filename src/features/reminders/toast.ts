import { findVoice, type VoicePrefs } from '../../lib/voice'
import { getVoicePrefs } from './voicePrefs'

export interface ToastMsg { id: string; title: string; body: string }

export function emitToast(t: Omit<ToastMsg, 'id'>) {
  window.dispatchEvent(new CustomEvent<ToastMsg>('app:toast', { detail: { ...t, id: crypto.randomUUID() } }))
}

export function playBeep() {
  try {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext ?? w.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.start(); osc.stop(ctx.currentTime + 0.45)
    osc.onended = () => { void ctx.close() }
  } catch { /* autoplay blocked or unsupported: the toast still shows */ }
}

// Reads text aloud with the browser's built-in text-to-speech, using the voice, speed and pitch chosen
// in Settings. `times` repeats it (reminders are read REMINDER_REPEATS times) with a short pause between.
// Returns false when speech is unsupported or turned off, so the caller can beep instead.
export function speak(text: string, times = 1, prefs: VoicePrefs = getVoicePrefs()): boolean {
  try {
    if (!prefs.enabled || !('speechSynthesis' in window)) return false
    const synth = window.speechSynthesis
    const voice = findVoice(synth.getVoices(), prefs.voiceURI)
    let beeped = false
    for (let i = 0; i < times; i++) {
      // Queued, not cancelled, so two reminders due at once are both read in full.
      const u = new SpeechSynthesisUtterance(text)
      if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = document.documentElement.lang || 'en-US'
      u.rate = prefs.rate
      u.pitch = prefs.pitch
      u.onerror = e => { if (e.error === 'not-allowed' && !beeped) { beeped = true; playBeep() } }
      synth.speak(u)
      if (i < times - 1) {
        const gap = new SpeechSynthesisUtterance(' ')
        gap.volume = 0
        gap.rate = 0.5
        synth.speak(gap)
      }
    }
    return true
  } catch { return false }
}

// Stops anything being read, for example when the test button is pressed again.
export function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}

// Browsers only allow speech after the user has interacted with the page (iOS needs a tap).
// The first tap or key press unlocks speech with a silent utterance.
function unlockSpeech() {
  try {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockSpeech, { once: true })
  window.addEventListener('keydown', unlockSpeech, { once: true })
}
