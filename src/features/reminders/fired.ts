const KEY = 'dtt.firedReminders'
const MAX = 500

export function loadFired(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function markFired(id: string) {
  const list = [...loadFired(), id].slice(-MAX)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* storage full or blocked */ }
}
