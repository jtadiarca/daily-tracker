@echo off
rem Double-click launcher for scripts\setup.ps1.
rem It allows the script to run this one time without changing any system setting.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
echo.
pause
