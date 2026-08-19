# Check the install and report what is missing.
# Windows PowerShell. Finds a Python 3.10+ and hands over to scripts\doctor.py.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$py = $null
foreach ($candidate in @("python", "python3", "py")) {
  $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($cmd) {
    & $candidate -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" 2>$null
    if ($LASTEXITCODE -eq 0) { $py = $candidate; break }
  }
}

if (-not $py) {
  Write-Host "No Python 3.10 or newer found on PATH." -ForegroundColor Red
  Write-Host "  Install from https://www.python.org/downloads/ and tick 'Add to PATH'."
  exit 1
}

& $py scripts\doctor.py  @args
exit $LASTEXITCODE
