#!/usr/bin/env pwsh
<#
.SYNOPSIS
Stop and remove the ZAP scanner container.
.EXAMPLE
pwsh scripts/stop-zap.ps1
#>
$Container = "zap_scanner"
docker rm -f $Container 2>$null | Out-Null
Write-Host "[*] ZAP container stopped."