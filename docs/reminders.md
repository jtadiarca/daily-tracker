# Reminders: how they work and their limits

- Reminders are scheduled with `setTimeout` while the app is open, and re-planned whenever tasks, completions
  or settings change, when the day rolls over, and when the tab regains focus.
- If the app opens during a reminder's window (after its fire time, up to 5 minutes after the due time),
  the reminder fires immediately. Each occurrence fires only once (tracked in localStorage).
- With notification permission granted, reminders use the service worker (`public/sw.js`) so a click opens
  the app on Today. If permission is denied or unsupported, an in-app toast and a short beep are used instead.
- Reminder offset values: null = use default setting, -1 = none, 0 = at time, N = N minutes before.
  The default setting is "none" until the Settings screen arrives in Milestone 5.

## Limitation
Browsers cannot guarantee notifications while a PWA is fully closed. The Notification Triggers API
(`showTrigger`) was a Chrome experiment; Chrome's docs say its development has ended and it never shipped
outside an experimental flag, so this app does not depend on it. Scheduled-while-closed reminders need either a
push server or a native wrapper. An optional Capacitor wrapper with local notifications is a possible later milestone.

iOS and iPadOS only allow web notifications for apps installed to the Home Screen (iOS 16.4+), and permission
must be requested from a tap.
