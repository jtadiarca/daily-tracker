# Daily Task Tracker

A personal daily to-do app that works offline and keeps all of its data on your device. Add tasks, give them times, get reminders, check them off, and watch your streaks. Move your data between devices with a backup file.

- Installable Progressive Web App, mobile first and responsive on desktop.
- Single user, no login, no backend. Nothing is ever sent to a server.
- Stack: React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa (Workbox), date-fns, Recharts, Zod, Vitest.

## Features

- **Today:** tasks sorted by time, an Anytime section for untimed tasks, check and uncheck, quick add.
- **Tasks:** title, notes, date, optional time, repeat (daily, weekdays, weekly on chosen days), reminder offset. Deleting a repeating task asks "this one only" or "all future".
- **Status:** done, upcoming and missed are derived, never stored. Untimed tasks only become missed after local midnight.
- **Reminders:** spoken aloud first (beep only if speech fails), plus a system notification or an in-app toast. See [docs/reminders.md](docs/reminders.md).
- **Upcoming:** the next 14 days.
- **Dashboard:** today's progress ring, completion rate chart (7 days, 30 days or a custom range), current and best streak, and a missed list with "Mark done late" and "Reschedule to today".
- **Settings:** install, default reminder, notification permission, 12 or 24 hour time (12 hour by default), backup and transfer.
- **Design:** Material 3 color roles, shapes and components, with light and dark themes that follow the system setting.

## Set up on a new Windows PC

The setup script installs what is missing and gets the app running. It will:

1. Allow local PowerShell scripts for your user (execution policy `RemoteSigned`), which fixes the "running scripts is disabled" error for `npm`.
2. Install Git and Node.js LTS with winget if they are missing or older than Node 20.
3. Clone this repository (or update it), run `npm install`, and run the tests.
4. Start the development server and open the app in your browser.

If you already have the project, double-click `setup.cmd`, or run this in PowerShell from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Options: `-Dir C:\dev\daily-tracker` (where to clone), `-SkipTests`, `-Build` (also run a production build), `-NoStart` (do not start the app), `-RepoUrl <url>`.

If the project is not on the machine yet and the repository is public, this one line downloads and runs the script:

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/jtadiarca/daily-tracker/main/scripts/setup.ps1 -OutFile $env:TEMP\setup-daily-tracker.ps1; & $env:TEMP\setup-daily-tracker.ps1"
```

If the repository is private, open `scripts/setup.ps1` on GitHub, choose Raw, save it, and run it with the command above. Git will ask you to sign in when it clones.

Notes: Windows may show a permission prompt while winget installs Git and Node. The script needs winget, which comes with the Microsoft Store's App Installer on Windows 10 and 11. On macOS or Linux, install Git and Node.js 20 or newer yourself, then follow the steps below.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # development server (also registers a dev service worker)
npm test           # unit tests (Vitest)
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build locally
```

Test installing and going offline with `npm run preview`, not `npm run dev`. In Chrome DevTools open Application, then Manifest and Service Workers, tick Offline under Network, and reload.

On Windows PowerShell, if scripts are blocked, use `npm.cmd` instead of `npm`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Deploy

The build output is a static site in `dist/`. Any static host works, but it must use HTTPS (service workers only run on HTTPS and on localhost) and it must serve the app from the root of its domain.

**Netlify:** import the repository, then use build command `npm run build` and publish directory `dist`. Netlify usually detects both from Vite.

**Vercel:** import the repository. Vercel detects Vite and uses `npm run build` with output directory `dist`.

**Command line:** `npx netlify-cli deploy --prod --dir=dist` or `npx vercel --prod`.

**GitHub Pages:** project sites live under `/repo-name/`, and this app assumes the domain root. It would need `base` set in `vite.config.ts` and the manifest `start_url`, `scope` and the service worker's `/index.html` fallback changed to match. Use Netlify or Vercel unless you have a custom domain at the root.

After deploying, open the site on each device, use the browser's Install option (on iPhone or iPad: Share, then Add to Home Screen), and allow notifications from Settings.

## Moving data between devices

1. On device A open Settings, Export data. The file is named `daily-tracker-backup-YYYY-MM-DD.json`. On phones the share sheet is used when available, otherwise the file downloads.
2. Get the file to device B (AirDrop, email, cloud drive).
3. On device B open Settings, Import data (or drag the file onto the page on desktop). A preview shows how many items are new, updated and unchanged.
4. Choose Merge (default) or Replace everything.
5. If something looks wrong, press Undo import. It stays available until you next open the app, and it also removes changes made since the import.

Export from every device regularly. A banner appears after 14 days without an export.

## How merging works

- Records are matched by id. Ids are random UUIDs created on the device, so two devices never collide.
- Tasks, completions and settings use last write wins by `updatedAt`. The newer record wins, including deletions (tombstones).
- If `updatedAt` is equal, the record that is not deleted wins. Any remaining tie is broken by a fixed content order, so the result never depends on which device imports.
- Records that exist on only one side are kept.
- Importing the same file twice changes nothing, and importing A into B and B into A ends with identical data.
- Records stamped more than 24 hours in the future are ignored and reported, to guard against a wrong device clock.
- The whole import runs in one database transaction. If anything fails, nothing changes.
- Dates are plain local `YYYY-MM-DD` strings and times are `HH:mm`, so a backup from a different time zone does not shift anything. Only `updatedAt` and `deletedAt` are UTC timestamps.
- Notification permission belongs to the device and is never exported or imported.

## Reminders and their limits

Reminders are scheduled with timers while the app is open, and re-planned whenever data changes. Browsers cannot guarantee notifications while a PWA is fully closed. The Notification Triggers API was a Chrome experiment that never shipped, so this app does not use it. For reliable closed-app reminders, an optional Capacitor wrapper with local notifications is the natural next step. iOS and iPadOS only allow web notifications for apps added to the Home Screen.

## Project layout

```
scripts/setup.ps1   one-command setup for a new Windows PC (setup.cmd is a double-click launcher)
src/db              Dexie schema, repositories, backup and import code
src/lib             pure, tested logic: dates, recurrence, status, stats, reminders, merge, schema, migrations
src/features        today, upcoming, dashboard, settings, reminders, backup
src/components      shared components
src/sw.ts           service worker (precaching, offline shell, notification click)
```

## Changing the backup format

Backups carry a `schemaVersion`. To ship version 2: bump `CURRENT_SCHEMA_VERSION` in `src/lib/migrations.ts`, add a `1: (env) => ...` step to `MIGRATIONS` that returns `schemaVersion: 2`, update the Zod schema in `src/lib/schema.ts`, and add a test. Older backups are then upgraded step by step on import. Files from a newer version than the app understands are rejected with a clear message.

## Known limitations

- Deleted items are purged 90 days after deletion. A device that was offline longer than that and still holds a live copy can bring a purged item back on import, so export from every device regularly.
- Edits merge per record, not per field. If the same task is edited on two devices, the later edit replaces the whole record.
- Reschedule to today creates a one-off copy and keeps the original date as missed in the history.
- Out of scope for version 1: accounts, cloud sync, sharing, subtasks, native apps and encrypted backups.
- `npm audit` reports advisories in build and test tools, and a memory-use advisory in Zod 3 that is only fixed in Zod 4. Moving to Zod 4 is a planned, separate change.

## Manual acceptance checklist

- Add a timed task, receive its reminder, check it off, and see it counted on the dashboard.
- Leave a timed task unchecked past its time and see it as missed on the dashboard.
- Reload, and go offline: the app still works with your data.
- Export on device A, import on device B, and see the same tasks, history and streaks.
- Make different changes on both devices, import in both directions, and confirm both end up identical.
