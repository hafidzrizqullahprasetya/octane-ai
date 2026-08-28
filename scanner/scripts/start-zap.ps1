#!/usr/bin/env pwsh
<#
.SYNOPSIS
Start OWASP ZAP as a Docker daemon for programmatic (REST API) scanning.
.DESCRIPTION
Runs ZAP in headless daemon mode listening on 127.0.0.1:8090. The REST API
endpoints are used by scan.ps1. Container name is fixed so start is idempotent.
.PARAMETER Cookie
  Optional Cookie header value to inject into all scanned requests via ZAP's
  Replacer, e.g. "session=abc123;lang=en" (for scanning behind a login/session).
.PARAMETER Restart
  Force recreate the container (needed if changing -Cookie on a running daemon).
.EXAMPLE
pwsh scripts/start-zap.ps1
pwsh scripts/start-zap.ps1 -Cookie "session=abc123" -Restart
#>
param(
    [string]$Cookie = "",
    [switch]$Restart
)
$ErrorActionPreference = "Stop"
$Container = "zap_scanner"
$Image     = "ghcr.io/zaproxy/zaproxy:stable"
$Port      = "8090"

function Fail($msg) { Write-Error $msg; exit 1 }

$rules = @()
if ($Cookie) {
    $rules = @(
        "-config", "replacer.full_list(0).description=Inject Cookie",
        "-config", "replacer.full_list(0).enabled=true",
        "-config", "replacer.full_list(0).matchtype=REQ_HEADER",
        "-config", "replacer.full_list(0).matchregex=false",
        "-config", "replacer.full_list(0).matchstring=Cookie",
        "-config", "replacer.full_list(0).replacement=$Cookie",
        "-config", "replacer.full_list(0).matchurl=",
        "-config", "replacer.full_list(0).matchmethod="
    )
}

$existing = docker ps -a --filter "name=^/${Container}$" --format "{{.Names}}" 2>$null
if ($Restart) {
    docker rm -f $Container 2>$null | Out-Null
    $existing = $null
}

if ($existing -contains $Container) {
    $running = docker ps --filter "name=^/${Container}$" --format "{{.Names}}" 2>$null
    if ($running -contains $Container) {
        Write-Host "[*] ZAP already running on port $Port (cookie changes require -Restart)"
    } else {
        Write-Host "[*] Starting existing ZAP container..."
        docker start $Container | Out-Null
    }
} else {
    Write-Host "[*] Pulling ZAP image (first run only)..."
    docker pull $Image | Out-Null
    Write-Host "[*] Creating ZAP daemon container..."
    $dockerArgs = @(
        "run", "-d", "--rm", "--name", $Container, "-p", "${Port}:8090", $Image,
        "zap.sh", "-daemon", "-port", "8090", "-host", "0.0.0.0",
        "-config", "api.disablekey=true",
        "-config", "api.addrs.addr.name=.*",
        "-config", "api.addrs.addr.regex=true"
    ) + $rules
    & docker @dockerArgs 2>$null
    if ($LASTEXITCODE -ne 0) { Fail "Failed to start ZAP container" }
}

# Wait for ZAP API to be alive.
Write-Host "[*] Waiting for ZAP API on port ${Port}..."
$deadline = (Get-Date).AddSeconds(120)
$ok = $false
do {
    Start-Sleep -Milliseconds 1500
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:${Port}/JSON/core/view/version/" `
            -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $ok = $true }
    } catch { $ok = $false }
} until ($ok -or (Get-Date) -gt $deadline)

if (-not $ok) { Fail "ZAP API did not come up in time. Check 'docker logs ${Container}'." }
$ver = (Invoke-RestMethod "http://127.0.0.1:${Port}/JSON/core/view/version/").version
Write-Host "[+] ZAP ready. API version: $ver"
if ($Cookie) { Write-Host "[+] Cookie injection enabled." }
$env:ZAP_DAEMON = "http://127.0.0.1:${Port}"
Write-Host "[+] ZAP_DAEMON set for scan.ps1."