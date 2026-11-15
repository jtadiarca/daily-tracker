# Reminders: how they work and their limits

- Reminders are scheduled with `setTimeout` while the app is open, and re-planned whenever tasks, completions
  or settings change, when the day rolls over, and when the tab regains focus.
- If the app opens during a reminder's window (after its fire time, up to 5 minutes after the due time),
  the reminder fires immediately. Each occurrence fires only once (tracked in localStorage).
- Every reminder is read aloud first with the browser's text-to-speech. A short beep plays only if speech is
  unsupported or blocked.
- With notification permission granted, a system notification is also shown through the service worker
  (`public/sw.js`), and clicking it opens the app on Today. If permission is denied or unsupported, an in-app
  toast is shown instead.
- Speech needs the user to have interacted with the page first (Chrome since version 71; iOS needs a tap).
  The app unlocks speech on the first tap or key press. If it still cannot speak, it falls back to the beep.
- Reminder offset values: null = use default setting, -1 = none, 0 = at time, N = N minutes before.
  The default setting is "none" until the Settings screen arrives in Milestone 5.

## Limitation
Browsers cannot guarantee notifications while a PWA is fully closed. The Notification Triggers API
(`showTrigger`) was a Chrome experiment; Chrome's docs say its development has ended and it never shipped
outside an experimental flag, so this app does not depend on it. Scheduled-while-closed reminders need either a
push server or a native wrapper. An optional Capacitor wrapper with local notifications is a possible later milestone.

iOS and iPadOS only allow web notifications for apps installed to the Home Screen (iOS 16.4+), and permission
must be requested from a tap.
