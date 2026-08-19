@echo off
REM Check the install and report what is missing.
REM Double-clickable wrapper around the PowerShell script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0doctor.ps1" %*
if errorlevel 1 pause
