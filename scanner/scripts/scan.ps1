#!/usr/bin/env pwsh
<#
.SYNOPSIS
Run an OWASP ZAP spider + active scan against a target and emit reports.
.DESCRIPTION
Uses ZAP's REST API (via the running zap_scanner container started with
start-zap.ps1) to crawl and actively scan a target. Emits both a human-readable
HTML report and a machine-readable JSON report under scanner/results/ so an AI
agent can parse findings programmatically.

Requirements:
  - ZAP daemon running (see start-zap.ps1).
.PARAMETER Target
  Full URL to scan, e.g. http://localhost:8093 or https://example.com/app
.PARAMETER ReportZip
  Also write ZAP's full zip report archive.
.PARAMETER NoConfirm
  Skip the interactive authorization confirmation (non-interactive agents).
.EXAMPLE
pwsh scripts/scan.ps1 -Target "http://localhost:8093"
.EXAMPLE
pwsh scripts/scan.ps1 -Target "http://localhost:9000/api" -Cookie "session=deadbeef" -ReportZip -NoConfirm
#>
param(
    [Parameter(Mandatory)][string]$Target,
    [switch]$ReportZip,
    [switch]$NoConfirm
)
$ErrorActionPreference = "Stop"

# --- Safety gate --------------------------------------------------------
$Msg = @"

  You are about to actively scan:
    $Target

  Only run this against systems you own or are authorized to test.
  Active scanning sends malicious payloads (XSS, injection) to this server.

"@
if ($NoConfirm) {
    Write-Host "[*] Active scan on $Target (authorization auto-confirmed via -NoConfirm)"
} else {
    Write-Host $Msg -ForegroundColor Yellow
    $ans = Read-Host "Type YES to continue"
    if ($ans -ne "YES") { Write-Host "[!] Aborted."; exit 1 }
}

$Api     = if ($env:ZAP_DAEMON) { $env:ZAP_DAEMON } else { "http://127.0.0.1:8090" }
$Results = Join-Path $PSScriptRoot "..\results"
New-Item -ItemType Directory -Force -Path $Results | Out-Null

# --- Verify ZAP is up ---------------------------------------------------
try { $ver = (Invoke-RestMethod "$Api/JSON/core/view/version/" -TimeoutSec 10).version }
catch { Write-Error "ZAP API not reachable at $Api. Run start-zap.ps1 first."; exit 1 }
Write-Host "[*] ZAP version: $ver"

# --- Spider -------------------------------------------------------------
$encTarget = [System.Uri]::EscapeDataString($Target)
$spid = (Invoke-RestMethod "$Api/JSON/spider/action/scan/?url=$encTarget").scan
Write-Host "[*] Spider running, id=$spid"
do {
    Start-Sleep -Seconds 2
    $sp = Invoke-RestMethod "$Api/JSON/spider/view/status/?scanId=$spid&maxScanToConsider=0"
    $p  = [int]$sp.status
    if ($p -ge 0) { Write-Host "   spider $p%" }
} while ([int]$sp.status -lt 100 -and [int]$sp.status -ge 0)
Write-Host "[+] Spider complete."

# --- Active scan --------------------------------------------------------
$asid = (Invoke-RestMethod "$Api/JSON/ascan/action/scan/?url=$encTarget").scan
Write-Host "[*] Active scan running, id=$asid"
do {
    Start-Sleep -Seconds 3
    $as = Invoke-RestMethod "$Api/JSON/ascan/view/status/?scanId=$asid"
    $ap = [int]$as.status
    if ($ap -ge 0 -and $ap -lt 100) { Write-Host "   active $ap%" }
} while ([int]$as.status -lt 100 -and [int]$as.status -ge 0)
Write-Host "[+] Active scan complete."

# --- Collect alerts -----------------------------------------------------
$all = Invoke-RestMethod "$Api/JSON/core/view/alerts/?baseurl=$encTarget"
$alerts = @($all.alerts)
Write-Host ""
Write-Host "============================ FINDINGS ============================"
Write-Host "Found $($alerts.Count) alert(s)"
$summary = @()
foreach ($a in $alerts) {
    $risk = if ($a.risk) { [string]$a.risk } else { $a.riskdesc }
    $row = [PSCustomObject]@{
        risk      = $risk
        confidence= $a.confidence
        id        = $a.pluginId
        name      = $a.alert
        url       = $a.url
        evidence  = $a.evidence
    }
    $summary += $row
    Write-Host ("[{0}] {1} :: {2}" -f $risk, $a.alert, $a.url)
}
Write-Host "=================================================================="

# --- Save JSON report ---------------------------------------------------
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$safeName = ($Target -replace '[^\w.-]', '_')
$outJson = Join-Path $Results "report_${safeName}_${ts}.json"
$outHtml = Join-Path $Results "report_${safeName}_${ts}.html"
$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $outJson -Encoding utf8
Write-Host "[+] JSON report: $outJson"

# --- Save HTML report ---------------------------------------------------
$html = @"
<!doctype html><html><head><meta charset="utf-8"><title>ZAP Scan Report — $Target</title>
<style>body{font-family:system-ui;margin:2rem;background:#111;color:#eee}
table{border-collapse:collapse;width:100%}.high{color:#ff6b6b}.medium{color:#ffd93d}
.low{color:#6bcb77}.informational{color:#888}th,td{padding:.5rem;text-align:left;border-bottom:1px solid #333}</style>
</head><body><h1>Scan: $Target</h1>
<p>Generated $ts — $($alerts.Count) alerts</p>
<table><tr><th>Risk</th><th>Name</th><th>URL</th><th>Evidence</th></tr>
$( foreach ($a in $alerts) {
    $risk = if ($a.risk) { ([string]$a.risk) } else { ([string]$a.riskdesc) }
    "<tr><td class='$($risk.ToLower())'>$risk</td><td>$($a.alert)</td><td>$($a.url)</td><td>$($a.evidence)</td></tr>"
} )
</table></body></html>
"@
Set-Content -Path $outHtml -Value $html -Encoding utf8
Write-Host "[+] HTML report: $outHtml"

# --- Optional zip archive ----------------------------------------------
if ($ReportZip) {
    $zip = Join-Path $Results "zap_report_${safeName}_${ts}.zip"
    $htmlFull = (Invoke-WebRequest "$Api/OTHER/core/other/htmlreport/" -UseBasicParsing).Content
    $tmp = Join-Path $env:TEMP "zap_html_report.html"
    Set-Content -Path $tmp -Value $htmlFull -Encoding utf8
    Compress-Archive -Path $tmp -DestinationPath $zip -Force
    Write-Host "[+] Zip report: $zip"
}

Write-Host "[*] Done."
exit 0