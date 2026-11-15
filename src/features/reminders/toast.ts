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

// Reads text aloud with the browser's built-in text-to-speech. Returns false if speech is unsupported.
export function speak(text: string): boolean {
  try {
    if (!('speechSynthesis' in window)) return false
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = document.documentElement.lang || 'en-US'
    u.onerror = e => { if (e.error === 'not-allowed') playBeep() }
    synth.speak(u)
    return true
  } catch { return false }
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
