import { useId } from 'react'
import { findVoice, PITCH_RANGE, pitchLabel, RATE_RANGE, REMINDER_REPEATS, speedLabel } from '../../lib/voice'
import { formatTime } from '../../lib/time'
import { speak, stopSpeaking } from './toast'
import { setVoicePrefs, useVoicePrefs, useVoices } from './voicePrefs'

// Settings card for spoken reminders: on/off, voice, speed and pitch, with a test button.
export function VoiceSettings() {
  const prefs = useVoicePrefs()
  const voices = useVoices()
  const id = useId()
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const saved = findVoice(voices, prefs.voiceURI)
  // A voice chosen on this device that the browser no longer offers (for example an online voice while offline).
  const missing = prefs.voiceURI !== null && voices.length > 0 && !saved

  const test = () => {
    stopSpeaking()
    if (!speak(`Reminder. Take your vitamins. Due at ${formatTime('09:00', '12h')}.`, 1, { ...prefs, enabled: true })) {
      window.alert('This browser cannot speak. Reminders will beep instead.')
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card">
      <h2 id={`${id}-h`} className="mb-1 text-xl">Reminder voice</h2>
      <p className="mb-3 text-sm text-on-surface-variant">
        Each reminder is read aloud {REMINDER_REPEATS} times. Voices come from your browser and device, so this setting is saved on this device only.
      </p>
      {!supported ? <p>This browser can’t read reminders aloud. They will beep instead.</p> : (
        <div className="space-y-4">
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={prefs.enabled} onChange={e => setVoicePrefs({ enabled: e.target.checked })} />
            Read reminders aloud
          </label>
          {!prefs.enabled && <p className="text-sm text-on-surface-variant">Reminders will play a short beep instead. Notifications and pop-ups still appear.</p>}

          <fieldset disabled={!prefs.enabled} className="space-y-4 disabled:opacity-50">
            <label className="field-label">Voice
              <select className="field mt-1" value={saved ? saved.voiceURI : ''} onChange={e => setVoicePrefs({ voiceURI: e.target.value || null })}>
                <option value="">System default</option>
                {voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang}){v.localService ? '' : ' · needs internet'}</option>
                ))}
              </select>
            </label>
            {voices.length === 0 && <p className="text-sm text-on-surface-variant">Loading voices… If none appear, your browser only offers its default voice.</p>}
            {missing && <p role="status" className="text-sm text-on-surface-variant">The voice you chose isn’t available right now, so the system default is used.</p>}

            <label className="field-label">Speed: <span className="text-on-surface">{speedLabel(prefs.rate)}</span>
              <input type="range" className="mt-2 w-full accent-[rgb(var(--md-primary))]" min={RATE_RANGE.min} max={RATE_RANGE.max} step={RATE_RANGE.step}
                value={prefs.rate} aria-valuetext={speedLabel(prefs.rate)} onChange={e => setVoicePrefs({ rate: Number(e.target.value) })} />
            </label>
            <label className="field-label">Pitch: <span className="text-on-surface">{pitchLabel(prefs.pitch)}</span>
              <input type="range" className="mt-2 w-full accent-[rgb(var(--md-primary))]" min={PITCH_RANGE.min} max={PITCH_RANGE.max} step={PITCH_RANGE.step}
                value={prefs.pitch} aria-valuetext={pitchLabel(prefs.pitch)} onChange={e => setVoicePrefs({ pitch: Number(e.target.value) })} />
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-tonal" onClick={test}>Test voice</button>
              <button type="button" className="btn-text" onClick={() => setVoicePrefs({ voiceURI: null, rate: 1, pitch: 1 })}>Reset to default</button>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  )
}
