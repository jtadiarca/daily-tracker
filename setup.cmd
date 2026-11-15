@echo off
rem Double-click launcher for scripts\setup.ps1. Runs the script this one time without changing any system setting.
rem
rem With no arguments it does the full setup (or update) for everyday use:
rem   - lets PowerShell run local scripts, installs Git and Node.js if needed
rem   - pulls the latest code, installs packages, runs the tests and builds the app
rem   - installs or updates the DailyTaskTracker Windows service (starts at boot, http://localhost:4173)
rem   - adds a startup shortcut that opens the app at sign-in so reminders can fire
rem Windows asks for administrator permission for the service.
rem
rem Pass arguments to choose yourself, for example:  setup.cmd -NoStart   (just install, no service)
rem See scripts\setup.ps1 or the README for all options.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" -Service -AutoOpen
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
)
echo.
pause
