# Daily Task Tracker

A personal daily to-do app that works offline and keeps all of its data on your device. Add tasks, give them times, get reminders, check them off, and watch your streaks. Move your data between devices with a backup file.

- Installable Progressive Web App, mobile first and responsive on desktop.
- Single user, no login, no backend. Nothing is ever sent to a server.
- Stack: React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa (Workbox), date-fns, Recharts, Zod, Vitest.

## Features

- **Today:** tasks sorted by time, an Anytime section for untimed tasks, check and uncheck, quick add.
- **Tasks:** title, notes, category, date, optional time (or several times a day, each checked off separately), repeat (daily, weekdays, weekly, every N days, weeks, months or years, twice a month, monthly on a date or weekday, yearly) with an optional end date, and a reminder offset. Deleting a repeating task asks "this one only" or "all future".
- **Categories:** create, rename and delete your own categories in Settings and pick one in the task form (or create one on the spot). Today and Upcoming can show one category at a time (or No category) and group tasks under category headings or by time. Deleting a category keeps its tasks, which then show as No category. Categories travel in backups like tasks do. The filter and grouping choice is a per-device preference and is not part of a backup.
- **Status:** done, upcoming and missed are derived, never stored. Untimed tasks only become missed after local midnight.
- **Reminders:** read aloud 3 times (beep only if speech fails or is turned off), plus a system notification or an in-app toast. Settings, Reminder voice lets you pick the voice, speed and pitch on each device, with a Test button. See [docs/reminders.md](docs/reminders.md).
- **Upcoming:** the next 14 days.
- **Dashboard:** today's progress ring, completion rate chart (7 days, 30 days or a custom range), current and best streak, and a missed list with "Mark done late" and "Reschedule to today". A category filter narrows every number on the page to one category (or No category), and a "By category" card shows the completion rate of each category in the range. The Dashboard keeps its own filter, separate from Today and Upcoming.
- **Settings:** install, default reminder, notification permission, 12 or 24 hour time (12 hour by default), backup and transfer (file or Google Drive).
- **Design:** Material 3 color roles, shapes and components, with light and dark themes that follow the system setting.
- **Adaptive layout:** follows Material 3 window sizes, and switches when you rotate the device or resize the window.
  - Under 600px wide (phones held upright): bottom navigation bar, floating + button, and the task form as a bottom sheet.
  - 600px and wider (phones on their side, tablets, laptops): a navigation rail on the left with the + button at its top, so lists keep the full screen height. The task form opens as a centered dialog that scrolls on short screens.
  - 840px and wider: two columns. Today shows Scheduled and Anytime (or the category groups) side by side, Upcoming lays the days out in two columns, the Dashboard puts progress, streaks and the chart on the left and the category breakdown and missed tasks on the right, and Settings flows its cards into two columns.
  - The breakpoints are the `medium`, `expanded` and `short` screens in `tailwind.config.js`, plus the `.page`, `.page-width` and `.cols-2` classes in `src/index.css`.

## Set up on a new Windows PC

The setup script installs what is missing and gets the app running. It will:

1. Allow local PowerShell scripts for your user (execution policy `RemoteSigned`), which fixes the "running scripts is disabled" error for `npm`.
2. Install Git and Node.js LTS with winget if they are missing or older than Node 20.
3. Clone this repository (or update it), run `npm install`, and run the tests.
4. Start the development server and open the app in your browser.

### The easy way: double-click `setup.cmd`

If the project is already on the machine, double-click **`setup.cmd`** in the project folder. With no arguments it does the full everyday setup, so running it again later is also how you update:

1. Everything above: execution policy, Git and Node.js, `npm install` and the tests.
2. It pulls the latest code first. If you have uncommitted changes, it skips the pull and warns you, so your work is never touched.
3. It builds the app and installs, or updates, the **DailyTaskTracker** Windows service, which serves the app at http://localhost:4173 from boot. Windows asks for administrator permission, and the rest runs in an admin window. Press Enter there when it says it's done.
4. It adds the **startup shortcut** that opens the app, minimized, each time you sign in, so reminders can fire.

It doesn't start the development server. Open http://localhost:4173 instead. To pick options yourself, pass them on the command line, for example `setup.cmd -NoStart` installs everything without the service or shortcut.

### Running the script yourself

From PowerShell in the project folder, with no options, the script sets up the project and starts the development server (http://localhost:5173):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Options: `-Dir C:\dev\daily-tracker` (where to clone), `-SkipTests`, `-Build` (also run a production build), `-NoStart` (do not start the app), `-RepoUrl <url>`, and the service and startup options in the next two sections.

If the project is not on the machine yet and the repository is public, this one line downloads and runs the script:

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/jtadiarca/daily-tracker/main/scripts/setup.ps1 -OutFile $env:TEMP\setup-daily-tracker.ps1; & $env:TEMP\setup-daily-tracker.ps1"
```

If the repository is private, open `scripts/setup.ps1` on GitHub, choose Raw, save it, and run it with the command above. Git will ask you to sign in when it clones.

Notes: Windows may show a permission prompt while winget installs Git and Node. The script needs winget, which comes with the Microsoft Store's App Installer on Windows 10 and 11. On macOS or Linux, install Git and Node.js 20 or newer yourself, then follow the steps below.

## Start the app automatically when Windows boots (optional)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Service
```

Windows asks for administrator permission. The script then builds the app, installs NSSM (a small tool that lets Windows run a normal program as a service) with winget, and registers a service named `DailyTaskTracker` that starts at boot. It serves the built app with `vite preview` at `http://localhost:4173` (change it with `-Port`). The server listens on `127.0.0.1` only, so other computers cannot reach it. Logs are in `C:\ProgramData\DailyTaskTracker`.

- **Update:** `git pull`, then run the same command again. It rebuilds and replaces the service.
- **Remove:** `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -RemoveService`.
- **Check:** `Get-Service DailyTaskTracker`.

Things to know:

- **Separate data:** a browser keeps data per address and port, so `http://localhost:4173` starts empty. Export a backup from the old address (for example `http://localhost:5173`) and import it here.
- **Reminders need the app open:** the service only serves the files. Reminders run inside the page, so the app has to be open. The next section sets that up.
- **Not for sharing:** `vite preview` is meant for local use, not as a public production server. Use Netlify or Vercel if you want other devices to reach the app.
- **Folder choice:** keep the project in a plain folder such as `C:\dev`, not in OneDrive, so the service can always read it.

## Reminders without opening anything yourself (optional)

Reminders are timers inside the page, so the page must be open when a task is due. `-AutoOpen` adds a shortcut to your Startup folder that opens the app in a minimized app window every time you sign in:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Service -AutoOpen
```

Use `-Browser Chrome` or `-Browser Edge` to choose the browser (it should be the one where you install the app and allow notifications). Remove the shortcut with `-RemoveAutoOpen`.

Do these once:

1. Double-click the new shortcut (press Win+R and run `shell:startup` to find it), open Settings in the app, and press Turn on reminders, then Allow.
2. In the browser's Performance settings, add `http://localhost:4173` to "Always keep these sites active" (Chrome) or "Never put these sites to sleep" (Edge), so the page is not put to sleep and its timers keep running.
3. Leave the window open or minimized. Closing it stops reminders until the next sign-in.

Limits you cannot avoid in a browser app:

- **Spoken reminders need one click per sign-in.** Browsers refuse to speak until you have interacted with the page at least once. Notifications do not have that rule, so they appear on their own, but the spoken part stays silent (the beep is blocked the same way) until you click inside the window.
- **The PC must be awake and signed in.** A sleeping or powered-off PC cannot show reminders. After waking, a reminder that is at most five minutes past its due time still fires.
- **Focus assist or Do Not Disturb** can hide Windows notifications.
- For reminders that work with no window at all, the app would need a native wrapper (for example Electron or Capacitor) with its own background process. That is not part of this version.

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

## Google Drive backup (optional)

Settings, Backup and transfer, has **Save to Google Drive** and **Restore from Google Drive**.

- **Sign-in:** the first time, Google's sign-in popup asks you to pick your account and allow access. The app asks only for the `drive.file` permission, so it can see the files it saves and nothing else in your Drive.
- **Save:** uploads a backup named `daily-tracker-backup-YYYY-MM-DD-HHmm.json` into a **Daily Tracker backups** folder, created on first use. It also counts as an export for the 14-day reminder.
- **Restore:** lists the backups the app saved, newest first. Picking one goes through the same preview, Merge or Replace, and Undo as a file import.
- **Moving devices:** save on device A, restore on device B, signed in to the same Google account.
- **Sign-in lasts until you reload or close the app.** The access token is kept in memory only, never stored or backed up. Use **Sign out** or **Use another account** to switch.
- **Limits:**
  - Google Drive needs an internet connection.
  - Files you upload to the folder yourself (for example from Drive's website) won't show in the list, because `drive.file` only covers files this app created. Import those with **Import data** instead.

### One-time setup: get a Google client ID

Google requires every app that signs in to be registered. You do this once, and it's free.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project, for example "Daily Tracker".
2. **Turn on the Drive API:** APIs & Services, Library, search for **Google Drive API**, then Enable.
3. **Consent screen:** open **Google Auth Platform** (in older consoles, APIs & Services, OAuth consent screen).
   - App name "Daily Tracker", your email as the support and developer contact.
   - Audience **External**.
   - Under **Data access**, add the scope `.../auth/drive.file`.
   - Under **Audience**, add your own Google account (and anyone else who will use the app) as a **test user**. While the app is in testing mode, only test users can sign in.
4. **Client ID:** Clients (or Credentials), **Create client**, type **Web application**. Under **Authorized JavaScript origins** add every address you open the app from:
   - `http://localhost:5173` (`npm run dev`)
   - `http://localhost:4173` (`npm run preview` and the Windows service)
   - your deployed site, for example `https://your-app.netlify.app`

   No redirect URIs are needed. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.
5. Put it in the `.env` file in the project folder, and commit it:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
   - **Committing is safe.** A client ID isn't a secret: it ends up in the built app anyway. Google only accepts sign-ins from the authorized origins (step 4), and from test users while the app is in testing mode.
   - **Every machine gets it automatically.** Because `.env` is committed, every machine that clones or pulls the repo builds the app with the ID, including `setup.ps1` on a new PC and Netlify or Vercel. Nothing extra to copy.
   - **Per-machine override:** to use a different ID on one machine, put it in `.env.local`. That file is ignored by git and overrides `.env`.
6. Restart `npm run dev`, or rebuild with `npm run build`. For the Windows service, rerun `setup.ps1 -Service` so it rebuilds.

**Phones and other devices:** Google only allows sign-in from `https://` addresses or `localhost`.
- **Can't sign in:** opening the app through a PC's network address (for example `http://192.168.1.20:5173`).
- **To use Google Drive on a phone:** use a deployed `https://` copy of the app (see Deploy), and add that address to the authorized origins.

**Sign-in troubleshooting:**
- **"Access blocked" or "app has not completed verification":** add your account as a test user (step 3).
- **"origin_mismatch":** the address in the browser isn't in Authorized JavaScript origins (step 4). `localhost` and `127.0.0.1` count as different addresses.
- **Nothing happens when you click:** allow popups for the site.
- **"Google Drive API has not been used in project…":** enable the API (step 2) and wait a minute.

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
scripts/setup.ps1   one-command setup for a new Windows PC, with optional boot-time service and login shortcut (setup.cmd runs it with -Service -AutoOpen: the full setup or update in one double-click)
src/db              Dexie schema, repositories, backup and import code
src/lib             pure, tested logic: dates, recurrence, status, stats, reminders, merge, schema, migrations
src/features        today, upcoming, dashboard, settings, reminders, backup, categories
src/components      shared components (TabBar is the bottom bar on phones and the side rail on wider screens)
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
- Give tasks categories, then on the Dashboard pick a category and confirm the ring, streaks, chart and missed list only count that category.
- Rotate a phone (or narrow and widen a desktop window): the bottom bar turns into a side rail at 600px, two columns appear at 840px, and the task form stays usable in landscape.
