# Reminders: how they work and their limits

- Reminders are scheduled with `setTimeout` while the app is open, and re-planned whenever tasks, completions
  or settings change, when the day rolls over, and when the tab regains focus.
- If the app opens during a reminder's window (after its fire time, up to 5 minutes after the due time),
  the reminder fires immediately. Each occurrence fires only once (tracked in localStorage).
- Every reminder is read aloud 3 times (`REMINDER_REPEATS` in `src/lib/voice.ts`) with the browser's text-to-speech,
  with a short pause between. A short beep plays instead if speech is unsupported, blocked, or turned off.
- Settings, Reminder voice: turn speech on or off, pick any voice the browser offers, and set speed (0.5x to 2x)
  and pitch, with a Test voice button. Saved per device in localStorage (`dtt.voicePrefs`), never in backups,
  because each device has different voices. If the chosen voice is missing (for example an online voice while
  offline), the browser default is used. Edge offers the most natural voices on Windows ("Online (Natural)").
- Reminders due at the same moment are queued, so each one is read in full.
- With notification permission granted, a system notification is also shown through the service worker
  (`src/sw.ts`), and clicking it opens the app on Today. If permission is denied or unsupported, an in-app
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
