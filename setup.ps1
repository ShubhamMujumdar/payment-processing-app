<#
.SYNOPSIS
    Prepare the SDLC Spine demo. Idempotent: checks first, installs only what is missing.

.DESCRIPTION
    Verifies prerequisites, creates the Python virtual environment, installs both
    dependency sets, writes .env from the template if absent, and builds the graph.

    Safe to re-run. Every step reports whether it did work or found the work
    already done, so a second run costs seconds and tells you the state of the
    machine.

.PARAMETER Rebuild
    Discard the graph and rebuild it from scratch. The event log is re-ingested
    from source. Use after changing connectors or the projector.

.PARAMETER SkipGraph
    Install dependencies only. Useful on a machine with no network access to
    GitHub, or when you just want the tooling in place.

.EXAMPLE
    .\setup.ps1
    First run, or a health check on an existing checkout.

.EXAMPLE
    .\setup.ps1 -Rebuild
    Re-ingest every source and rebuild the graph.

.NOTES
    Requires Python 3.10+ and Node 18+. Needs no JDK and no Docker: the ArcadeDB
    package bundles its own Java runtime.
#>
[CmdletBinding()]
param(
    [switch]$Rebuild,
    [switch]$SkipGraph
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$spine = Join-Path $root 'spine'
$web = Join-Path $root 'web'
$venvPython = Join-Path $spine '.venv\Scripts\python.exe'

$script:changed = @()
$script:skipped = @()

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Did($text) { Write-Host "  [done] $text" -ForegroundColor Green; $script:changed += $text }
function Write-Ok($text) { Write-Host "  [ok]   $text" -ForegroundColor DarkGray; $script:skipped += $text }
function Write-Warn($text) { Write-Host "  [warn] $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  [fail] $text" -ForegroundColor Red; exit 1 }

# --------------------------------------------------------------------------
Write-Step 'Prerequisites'

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { Fail 'python not found on PATH. Install Python 3.10 or newer.' }
$pyVersion = (& python -c "import sys;print('%d.%d'%sys.version_info[:2])")
if ([version]$pyVersion -lt [version]'3.10') { Fail "Python $pyVersion found; 3.10 or newer required." }
Write-Ok "Python $pyVersion"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'node not found on PATH. Install Node 18 or newer.' }
$nodeVersion = (& node --version).TrimStart('v')
if ([int]($nodeVersion.Split('.')[0]) -lt 18) { Fail "Node $nodeVersion found; 18 or newer required." }
Write-Ok "Node $nodeVersion"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    # Only the code graph needs git, for blame-based provenance.
    Write-Warn 'git not found. The code graph will build without pull-request provenance.'
} else {
    Write-Ok 'git'
}

# --------------------------------------------------------------------------
Write-Step 'Configuration'

$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root '.env.example') $envFile
    Write-Did 'created .env from .env.example'
    Write-Warn 'GITHUB_TOKEN is empty. GitHub and CI stay unread until you add one.'
    Write-Warn 'ARCADE_ROOT_PASSWORD is empty. Set 8+ characters to enable ArcadeDB Studio.'
} else {
    Write-Ok '.env present'
    $envText = Get-Content $envFile -Raw
    if ($envText -notmatch '(?m)^GITHUB_TOKEN=\S') {
        Write-Warn 'GITHUB_TOKEN is empty - GitHub and CI will be skipped during ingest.'
    }
    if ($envText -notmatch '(?m)^ARCADE_ROOT_PASSWORD=\S{8}') {
        Write-Warn 'ARCADE_ROOT_PASSWORD is unset or under 8 characters - Studio will not start.'
    }
}

# --------------------------------------------------------------------------
Write-Step 'Python environment'

if (-not (Test-Path $venvPython)) {
    Write-Host '  creating virtual environment...'
    & python -m venv (Join-Path $spine '.venv')
    Write-Did 'created spine/.venv'
    $needPyDeps = $true
} else {
    Write-Ok 'spine/.venv present'
    # Re-install when requirements.txt is newer than the last successful install,
    # so a changed dependency set is not silently ignored.
    $stamp = Join-Path $spine '.venv\.deps-installed'
    $reqs = Join-Path $spine 'requirements.txt'
    $needPyDeps = (-not (Test-Path $stamp)) -or `
                  ((Get-Item $reqs).LastWriteTimeUtc -gt (Get-Item $stamp).LastWriteTimeUtc)
}

if ($needPyDeps) {
    Write-Host '  installing Python dependencies (bundles a JRE, first run takes a minute)...'
    & $venvPython -m pip install --quiet --upgrade pip
    & $venvPython -m pip install --quiet -r (Join-Path $spine 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { Fail 'pip install failed.' }
    Set-Content -Path (Join-Path $spine '.venv\.deps-installed') -Value (Get-Date -Format o) -Encoding utf8
    Write-Did 'installed Python dependencies'
} else {
    Write-Ok 'Python dependencies up to date'
}

& $venvPython -c "import arcadedb_embedded, fastapi, httpx, tree_sitter_java" 2>$null
if ($LASTEXITCODE -ne 0) { Fail 'Python dependencies are present but not importable. Delete spine\.venv and re-run.' }
Write-Ok 'Python imports verified'

# --------------------------------------------------------------------------
Write-Step 'Web dependencies'

$modules = Join-Path $web 'node_modules'
$pkg = Join-Path $web 'package.json'
$needNode = $false
if (-not (Test-Path $modules)) {
    $needNode = $true
} else {
    $marker = Join-Path $modules '.package-lock.json'
    if (Test-Path $marker) {
        if ((Get-Item $pkg).LastWriteTimeUtc -gt (Get-Item $marker).LastWriteTimeUtc) { $needNode = $true }
    }
}

if ($needNode) {
    Write-Host '  running npm install...'
    Push-Location $web
    try {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }
    } finally { Pop-Location }
    Write-Did 'installed web dependencies'
} else {
    Write-Ok 'web dependencies up to date'
}

# --------------------------------------------------------------------------
Write-Step 'Graph'

if ($SkipGraph) {
    Write-Ok 'skipped by request (-SkipGraph)'
} else {
    $dbPath = Join-Path $root 'data\databases\spine'
    $hasDb = Test-Path $dbPath

    if ($Rebuild -and $hasDb) {
        Remove-Item -Recurse -Force (Join-Path $root 'data')
        Write-Did 'removed existing store (-Rebuild)'
        $hasDb = $false
    }

    if (-not $hasDb) {
        Push-Location $spine
        try {
            # Order matters. Confluence and GitHub fill the event log; the code
            # graph must exist before reproject, because the traceability matrix
            # links requirements to code units by path.
            Write-Host '  ingesting sources...'
            & $venvPython -X utf8 -m spine.cli ingest
            if ($LASTEXITCODE -ne 0) { Fail 'ingest failed.' }

            Write-Host '  parsing the code graph...'
            & $venvPython -X utf8 -m spine.cli codegraph
            if ($LASTEXITCODE -ne 0) { Fail 'codegraph failed.' }

            Write-Host '  projecting the graph...'
            & $venvPython -X utf8 -m spine.cli reproject
            if ($LASTEXITCODE -ne 0) { Fail 'reproject failed.' }
        } finally { Pop-Location }
        Write-Did 'built the graph'
    } else {
        Write-Ok 'graph present (use -Rebuild to rebuild it)'
    }

    Push-Location $spine
    try { & $venvPython -X utf8 -m spine.cli status } finally { Pop-Location }
}

# --------------------------------------------------------------------------
Write-Step 'Summary'
Write-Host "  changed: $($script:changed.Count)   already in place: $($script:skipped.Count)"
Write-Host ''
Write-Host '  Ready. Start everything with:' -ForegroundColor Green
Write-Host '      .\start.ps1' -ForegroundColor White
Write-Host ''
