import { useCallback, useEffect, useState } from 'react'
import { getPermission, requestPermission, type PermissionState } from './notify'

// Why a click on "Turn on reminders" didn't end in a yes or no.
//  - 'waiting': the browser hasn't answered yet. Chrome and Edge often show a small bell icon in the address
//    bar ("quiet" prompt) instead of a popup, and the request stays open until you click it.
//  - 'no-prompt': the browser answered without asking, usually because the prompt was dismissed before.
export type AskProblem = 'waiting' | 'no-prompt' | null

// If the browser hasn't answered by then, it is most likely showing the quiet bell-icon prompt.
const SLOW_MS = 1500

export function useNotificationPermission() {
  const [perm, setPerm] = useState<PermissionState>(getPermission())
  const [problem, setProblem] = useState<AskProblem>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    const refresh = () => {
      const p = getPermission()
      setPerm(p)
      if (p !== 'default') setProblem(null)
    }
    window.addEventListener('focus', refresh)
    // Chrome and Edge report changes made from the address bar or site settings.
    let status: PermissionStatus | undefined
    navigator.permissions?.query({ name: 'notifications' as PermissionName })
      .then(s => { status = s; s.onchange = refresh })
      .catch(() => { /* not supported: the focus listener still catches changes */ })
    return () => { window.removeEventListener('focus', refresh); if (status) status.onchange = null }
  }, [])

  const ask = useCallback(async () => {
    setProblem(null)
    setAsking(true)
    const slow = window.setTimeout(() => setProblem('waiting'), SLOW_MS)
    try {
      const result = await requestPermission()
      setPerm(result)
      // Still undecided after the request: the prompt was closed, or never shown.
      setProblem(result === 'default' ? 'no-prompt' : null)
    } finally {
      window.clearTimeout(slow)
      setAsking(false)
    }
  }, [])

  return { perm, ask, asking, problem }
}

export const PROBLEM_TEXT: Record<'waiting' | 'no-prompt', string> = {
  waiting: 'Your browser is asking quietly. Look for a bell or lock icon at the left end of the address bar, click it, and choose Allow for notifications.',
  'no-prompt': 'Notifications weren’t turned on. If you didn’t see a prompt, your browser may have stopped asking after it was closed before. Click the lock or site-settings icon at the left end of the address bar, set Notifications to Allow, then reload the page.',
}
