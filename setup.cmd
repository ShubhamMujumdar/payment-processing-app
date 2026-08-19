@echo off
REM Install everything the demo needs, checking before it acts.
REM Double-clickable wrapper around the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
if errorlevel 1 pause
