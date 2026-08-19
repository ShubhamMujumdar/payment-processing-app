@echo off
REM Stop everything this started.
REM Double-clickable wrapper around the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" %*
if errorlevel 1 pause
