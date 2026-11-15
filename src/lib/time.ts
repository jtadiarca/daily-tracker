export function formatTime(time: string, mode: '12h' | '24h' = '24h'): string {
  if (mode === '24h') return time
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
