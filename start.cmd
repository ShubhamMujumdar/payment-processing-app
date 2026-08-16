@echo off
REM Double-click entry point. Runs start.ps1 with the execution policy relaxed
REM for this invocation only, so no machine-wide policy change is needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
