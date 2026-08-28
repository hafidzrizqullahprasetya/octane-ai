#!/usr/bin/env pwsh
<#
.SYNOPSIS
Manual HTTP header-injection (CRLF) and reflected-XSS quick checks.
.DESCRIPTION
Probes a URL with raw payloads and reports pass/fail per check. Uses .NET
HttpClient with kebab-style handling to control CRLF injection. Useful for a
fast sanity pass before/without running full ZAP.
.PARAMETER Target
  Full URL including a query parameter to fuzz, e.g.
  http://localhost:8093/search?q=hello
.EXAMPLE
pwsh scripts/inject-test.ps1 -Target "http://localhost:8093/search?q=hello"
#>
param(
    [Parameter(Mandatory)][string]$Target
)
$ErrorActionPreference = "Stop"

# --- Break down target into base + parameter ----------------------------
$uri = [System.Uri]::new($Target)
$sep = if ($uri.Query) { "&" } else { "?" }
$base = $uri.GetLeftPart([System.UriPartial]::Path)

function Probe([string]$label, [string]$url, [hashtable]$extraHeaders = @{}) {
    try {
        $handler = [System.Net.Http.HttpClientHandler]::new()
        $handler.AllowAutoRedirect = $true
        $client  = [System.Net.Http.HttpClient]::new($handler)
        $req = [System.Net.Http.HttpRequestMessage]::new("GET", $url)
        foreach ($k in $extraHeaders.Keys) {
            if (-not $req.Headers.TryAddWithoutValidation($k, $extraHeaders[$k])) {
                $req.Content.Headers.TryAddWithoutValidation($k, $extraHeaders[$k]) | Out-Null
            }
        }
        $resp = $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        $status = [int]$resp.StatusCode
        $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $client.Dispose()
        [PSCustomObject]@{ label=$label; status=$status; reflected=($body -match '<script>|onerror=|alert\(') ; bodyLen=$body.Length }
    } catch {
        [PSCustomObject]@{ label=$label; status="ERR"; reflected=$false; bodyLen=-1 }
    }
}

Write-Host ""
Write-Host "=== HTTP Header Injection / XSS quick checks ==="
Write-Host "Target base: $base"

$results = @()

# 1. CRLF in query value -> header reflection attempt
$r1 = Probe "CRLF-in-query (header inject)" ($base + $sep + "q=%0d%0aX-Injected:%20pwned")
$results += $r1

# 2. CRLF in a custom header value being passed through
$r2 = Probe "CRLF-in-header (User-Agent)" $Target @{"User-Agent"="Mozilla/5.0`r`nX-Injected: pwned"}
$results += $r2

# 3. Reflected XSS (tag)
$r3 = Probe "Reflected XSS <script>" ($base + $sep + 'q=%3Cscript%3Ealert(1)%3C/script%3E')
$results += $r3

# 4. Reflected XSS (img onerror)
$r4 = Probe "Reflected XSS img/onerror" ($base + $sep + 'q=%3Cimg%20src=x%20onerror=alert(1)%3E')
$results += $r4

# 5. Reflected XSS (SVG onload)
$r5 = Probe "Reflected XSS svg/onload" ($base + $sep + 'q=%3Csvg/onload=alert(1)%3E')
$results += $r5

# 6. Basic SQL-ish probe for signal (not full sqli)
$r6 = Probe "Quote-inject probe" ($base + $sep + "q=' OR 1=1--")
$results += $r6

Write-Host ""
Write-Host ("{0,-34} {1,-7} {2,-8} {3}" -f "CHECK", "STATUS", "REFLECT", "LEN")
Write-Host ("-"*70)
foreach ($r in $results) {
    Write-Host ("{0,-34} {1,-7} {2,-8} {3}" -f $r.label, $r.status, $r.reflected, $r.bodyLen)
}

$reflected = @($results | Where-Object { $_.reflected })
Write-Host ""
if ($reflected.Count -gt 0) {
    Write-Host "[!] POTENTIAL XSS/reflection in:" -ForegroundColor Red
    foreach ($r in $reflected) { Write-Host ("    - {0}" -f $r.label) -ForegroundColor Red }
    Write-Host "[!] Manually verify with ZAP scan for confirmation." -ForegroundColor Yellow
} else {
    Write-Host "[+] No obvious reflected XSS or CRLF header injection detected in quick probe." -ForegroundColor Green
}
Write-Host "[*] Note: CRLF in headers is often normalized by HttpClient; a negative here does not prove safety."
Write-Host "[*] Run a full ZAP active scan for authoritative results: pwsh scripts/scan.ps1 -Target <url>"