<#
.SYNOPSIS
    Start the SDLC Spine demo. Runs setup first if anything is missing.

.DESCRIPTION
    Brings up two processes and reports their URLs:

      spine API   http://127.0.0.1:8077   read API over the graph
      Studio      http://localhost:2480   ArcadeDB's own graph browser
      console     http://localhost:5174   the delivery console

    Studio only appears when ARCADE_ROOT_PASSWORD is set to 8 or more characters
    in .env; it is served by the same process that holds the database, because
    the embedded engine takes an exclusive lock and a second process could not
    attach to the same store.

    Ports already in use are reported rather than silently reused, since a stale
    server from an earlier session serving old code is a confusing way to lose
    half an hour.

.PARAMETER Rebuild
    Rebuild the graph from source before starting.

.PARAMETER Fixtures
    Run the console against seeded fixtures instead of the live graph. Useful for
    a demo on a machine with no network, or to show the console without the API.

.PARAMETER NoBrowser
    Do not open a browser window.

.EXAMPLE
    .\start.ps1

.EXAMPLE
    .\start.ps1 -Rebuild
    Re-ingest and reproject, then start.

.NOTES
    Stop everything with .\stop.ps1. Logs are written to .\logs\.
#>
[CmdletBinding()]
param(
    [switch]$Rebuild,
    [switch]$Fixtures,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$spine = Join-Path $root 'spine'
$web = Join-Path $root 'web'
$venvPython = Join-Path $spine '.venv\Scripts\python.exe'
$logs = Join-Path $root 'logs'
$apiPort = 8077
$webPort = 5174
$studioPort = 2480

function Write-Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-Ok($t) { Write-Host "  [ok]   $t" -ForegroundColor DarkGray }
function Write-Info($t) { Write-Host "  $t" }
function Write-Warn($t) { Write-Host "  [warn] $t" -ForegroundColor Yellow }
function Fail($t) { Write-Host "  [fail] $t" -ForegroundColor Red; exit 1 }

function Test-Port($port) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $c
}

function Wait-Url($url, $seconds, $label) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { return $true }
        } catch { Start-Sleep -Seconds 1 }
    }
    Write-Warn "$label did not answer within $seconds seconds."
    return $false
}

# --------------------------------------------------------------------------
Write-Step 'Preflight'

if (-not (Test-Path $venvPython) -or -not (Test-Path (Join-Path $web 'node_modules'))) {
    Write-Info 'dependencies missing, running setup...'
    $setupArgs = @()
    if ($Rebuild) { $setupArgs += '-Rebuild' }
    & (Join-Path $root 'setup.ps1') @setupArgs
    if ($LASTEXITCODE -ne 0) { Fail 'setup failed.' }
} elseif ($Rebuild) {
    & (Join-Path $root 'setup.ps1') -Rebuild
    if ($LASTEXITCODE -ne 0) { Fail 'setup failed.' }
} else {
    Write-Ok 'dependencies in place'
    if (-not (Test-Path (Join-Path $root 'data\databases\spine'))) {
        Write-Info 'no graph found, building it...'
        & (Join-Path $root 'setup.ps1')
        if ($LASTEXITCODE -ne 0) { Fail 'setup failed.' }
    } else {
        Write-Ok 'graph present'
    }
}

foreach ($p in @($apiPort, $webPort, $studioPort)) {
    if (Test-Port $p) {
        Fail "Port $p is already in use. Run .\stop.ps1 first, or the old process will keep serving stale code."
    }
}
Write-Ok "ports $apiPort, $webPort, $studioPort free"

New-Item -ItemType Directory -Force -Path $logs | Out-Null

# --------------------------------------------------------------------------
Write-Step 'Starting the spine'

$apiLog = Join-Path $logs 'spine-api.log'
Start-Process -FilePath $venvPython `
    -ArgumentList '-X', 'utf8', '-m', 'spine.cli', 'serve' `
    -WorkingDirectory $spine `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError (Join-Path $logs 'spine-api.err.log') `
    -WindowStyle Hidden | Out-Null

if (Wait-Url "http://127.0.0.1:$apiPort/health" 60 'spine API') {
    Write-Ok "read API      http://127.0.0.1:$apiPort"
} else {
    Fail "spine API did not start. See $apiLog"
}

$studioUp = $false
try {
    $s = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/studio" -TimeoutSec 5
    $studioUp = $s.enabled
} catch { }
if ($studioUp) {
    Write-Ok "ArcadeDB Studio http://localhost:$studioPort  (sign in as 'root')"
} else {
    Write-Warn 'Studio disabled - set ARCADE_ROOT_PASSWORD (8+ chars) in .env to enable it.'
}

# --------------------------------------------------------------------------
Write-Step 'Starting the console'

$mode = 'live'
if ($Fixtures) { $mode = 'fixtures' }

# Written without a byte-order mark. Set-Content -Encoding utf8 emits a BOM on
# Windows PowerShell 5.1, and a BOM at the head of a dotenv file is read as part
# of the first key by some parsers.
$envLines = @(
    '# Written by start.ps1. Safe to edit; it is gitignored.'
    "VITE_SPINE_MODE=$mode"
    "VITE_SPINE_URL=http://127.0.0.1:$apiPort"
)
[System.IO.File]::WriteAllLines(
    (Join-Path $web '.env.local'),
    $envLines,
    (New-Object System.Text.UTF8Encoding $false)
)
Write-Ok "console data source: $mode"

$webLog = Join-Path $logs 'web.log'
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "npm run dev -- --port $webPort --strictPort" `
    -WorkingDirectory $web `
    -RedirectStandardOutput $webLog `
    -RedirectStandardError (Join-Path $logs 'web.err.log') `
    -WindowStyle Hidden | Out-Null

if (Wait-Url "http://localhost:$webPort/" 90 'console') {
    Write-Ok "console       http://localhost:$webPort"
} else {
    Fail "console did not start. See $webLog"
}

# --------------------------------------------------------------------------
Write-Step 'Running'

Write-Host ''
Write-Host "  Delivery console   http://localhost:$webPort/" -ForegroundColor White
Write-Host "  Traceability       http://localhost:$webPort/traceability" -ForegroundColor White
Write-Host "  Graph explorer     http://localhost:$webPort/graph" -ForegroundColor White
Write-Host "  Read API           http://127.0.0.1:$apiPort/health" -ForegroundColor DarkGray
if ($studioUp) {
    Write-Host "  ArcadeDB Studio    http://localhost:$studioPort/  (root)" -ForegroundColor DarkGray
}
Write-Host ''
Write-Host "  Logs in $logs" -ForegroundColor DarkGray
Write-Host '  Stop with .\stop.ps1' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) { Start-Process "http://localhost:$webPort/" }
