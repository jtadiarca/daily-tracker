@echo off
rem Double-click to remove Daily Task Tracker from this PC: the Windows service, its logs, the startup shortcut,
rem and the installed packages and build output. It asks before uninstalling NSSM or deleting the project folder.
rem Windows asks for administrator permission to remove the service. Git and Node.js stay installed.
rem
rem Options, for example:  uninstall.cmd -Yes -RemoveNssm     See scripts\uninstall.ps1 for all of them.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall.ps1" %*
echo.
pause
