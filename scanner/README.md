# Web Security Scanner (AI-agent friendly)

Automated XSS / HTTP-injection testing toolset for targets you are **authorized**
to test (your own apps/accounts). Runs on Windows via Docker.

> Use only on systems you own or have explicit permission to test.
> Unauthorized scanning is illegal.

## Quick start

```bash
# 1. Start ZAP in daemon mode (stays running for scanning)
pwsh scripts/start-zap.ps1

# 2. Scan a target
pwsh scripts/scan.ps1 -Target "http://host.docker.internal:8093" -ReportZip

# 2b. Or inject your own session cookie and scan behind login
#   (cookie is set at ZAP startup via the Replacer add-on)
pwsh scripts/start-zap.ps1 -Cookie "session=abc123" -Restart
pwsh scripts/scan.ps1 -Target "http://host.docker.internal:8093"
```

> **Important for localhost targets:** ZAP runs inside Docker, so it cannot reach
> your host's `127.0.0.1` directly. Point scans at `http://host.docker.internal:<port>/`
> (Docker Desktop) instead of `127.0.0.1`. For LAN/remote targets use their normal hostname.

Results are written to `scanner/results/`:
- `report_<target>_<ts>.json` — machine-readable JSON findings (AI-agent friendly: risk/confidence/name/url/evidence per alert)
- `report_<target>_<ts>.html` — human-readable HTML report
- `zap_report_<ts>.zip` — full ZAP report archive (when `-ReportZip`)

## Manual quick tests (no ZAP)

`scripts/inject-test.ps1` runs raw HTTP header-injection / CRLF checks and a
basic reflected-XSS probe against a URL:

```bash
pwsh scripts/inject-test.ps1 -Target "http://localhost:8093/api/search?q=hello"
```

Prints pass/fail per test with clear output. Useful as a fast sanity pass.

## Tool choice

| Need | Tool |
| --- | --- |
| Full active XSS / SQLi / header injection scan | OWASP ZAP (daemon + REST API) |
| Template-based scanning (nuclei-style) | ZAP's built-in passive/default scan |
| Manual CRLF / reflected-XSS probe | `scripts/inject-test.ps1` |
| DOM XSS | `scripts/dom-xss.ps1` (Playwright, optional) |

## Architecture

```
scanner/
  start-zap.ps1        # launch ZAP Docker daemon on port 8090
  stop-zap.ps1         # stop ZAP container
  scan.ps1             # spider + active scan + report via ZAP REST API
  inject-test.ps1      # manual CRLF + reflected-XSS quick checks
  dom-xss.ps1          # Playwright DOM-XSS probe (needs Python+playwright)
  results/             # generated reports (gitignored)
```