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
