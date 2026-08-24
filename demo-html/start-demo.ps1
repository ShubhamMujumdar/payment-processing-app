# Code2Doc — launch marketing demo + live app
# Double-click or run from PowerShell. No arguments needed.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repo = Resolve-Path (Join-Path $here "..")

# 1. Open HTML marketing demo in default browser
$demo = Join-Path $here "index.html"
if (Test-Path $demo) {
  Start-Process $demo
  Write-Host "  Opened   marketing demo — index.html" -ForegroundColor Green
} else {
  Write-Host "  Warning: index.html not found at $demo" -ForegroundColor Yellow
}

# 2. Start spine + code2doc + dashboard
$startScript = Join-Path $repo "start.ps1"
if (Test-Path $startScript) {
  Start-Process "powershell" -ArgumentList "-NoExit", "-File", "`"$startScript`""
  Write-Host "  Starting live app   spine :8077 · code2doc :8099 · dashboard :5173" -ForegroundColor Green
} else {
  Write-Host "  Warning: start.ps1 not found at $startScript" -ForegroundColor Yellow
  Write-Host "  Start the live app manually: python scripts\run.py start"
}

Write-Host ""
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Marketing demo   file://…/demo-html/index.html"
Write-Host "  Live dashboard   http://127.0.0.1:5173  (starting)"
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Shortcuts in the marketing demo:"
Write-Host "    →  /  ←   navigate slides"
Write-Host "    1 … 9     jump to screen"
Write-Host "    F         presentation / fullscreen mode"
Write-Host "    S         presenter notes"
Write-Host "    P         auto-play (4 s per slide)"
Write-Host "    ?         keyboard help"
Write-Host ""
