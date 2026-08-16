<#
.SYNOPSIS
    Stop everything start.ps1 started.

.DESCRIPTION
    Frees the three ports the demo uses. Stopping by port rather than by process
    name is deliberate: killing every python.exe or node.exe on the machine would
    take out unrelated work, and during a demo that is a bad afternoon.

.EXAMPLE
    .\stop.ps1
#>
[CmdletBinding()]
param()

$ports = @{ 8077 = 'spine API'; 2480 = 'ArcadeDB Studio'; 5174 = 'console' }
$stopped = 0

foreach ($port in $ports.Keys) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "  [ok]   $($ports[$port]) (port $port) not running" -ForegroundColor DarkGray
        continue
    }
    foreach ($procId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "  [done] stopped $($ports[$port]) (port $port, pid $procId)" -ForegroundColor Green
            $stopped++
        } catch {
            Write-Host "  [warn] could not stop pid $procId on port $port" -ForegroundColor Yellow
        }
    }
}

# The Studio port is served by the API process, so it usually disappears with it.
Write-Host ""
if ($stopped -eq 0) {
    Write-Host "  Nothing was running." -ForegroundColor DarkGray
} else {
    Write-Host "  Stopped $stopped process(es)." -ForegroundColor Green
}
