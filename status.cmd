@echo off
REM Show which services are up.
REM Double-clickable wrapper around the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1" %*
if errorlevel 1 pause
