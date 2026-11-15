let current: '12h' | '24h' = '24h'

// Set from the Settings screen; formatTime uses it when no format is passed.
export function setTimeFormat(f: '12h' | '24h') { current = f }

export function formatTime(hhmm: string, fmt: '12h' | '24h' = current): string {
  if (fmt === '24h') return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
