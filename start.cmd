@echo off
REM Start spine, code2doc and the dashboard.
REM Double-clickable wrapper around the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
