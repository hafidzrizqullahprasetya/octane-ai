# FOX ACTIVATION TRIGGER — Windows PowerShell
# Panggil ini setiap kali Fox mulai.
# Auto-load environment, check vault, resume sessions.

$FOX_HOME = if ($env:FOX_HOME) { $env:FOX_HOME } else { "$env:USERPROFILE\.fox" }
$VAULT_DIR = "$FOX_HOME\vault"
$MULTIBRAIN_DIR = "$FOX_HOME\multibrain"
$REPO_DIR = Split-Path -Parent $PSScriptRoot

Write-Host "🦊 Fox online." -ForegroundColor Red

# Check vault exists
if (-not (Test-Path $VAULT_DIR)) {
    Write-Host "  ⚠️  Vault not found. Run bootstrap/setup.ps1 first." -ForegroundColor Yellow
} else {
    Write-Host "  [+] Vault loaded: $VAULT_DIR" -ForegroundColor Green
}

# Check multibrain exists
if (-not (Test-Path $MULTIBRAIN_DIR\session.md)) {
    Write-Host "  ⚠️  No active session. Run bootstrap/setup.ps1 first." -ForegroundColor Yellow
} else {
    $SESSION = Get-Content "$MULTIBRAIN_DIR\session.md" -Head 10
    Write-Host "  [+] Session loaded" -ForegroundColor Green
}

# Export env vars for child sessions
$env:FOX_HOME = $FOX_HOME
$env:FOX_VAULT = $VAULT_DIR
$env:FOX_MULTIBRAIN = $MULTIBRAIN_DIR
$env:FOX_REPO = $REPO_DIR

Write-Host "  [+] Env vars set: FOX_HOME, FOX_VAULT, FOX_MULTIBRAIN" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to hunt." -ForegroundColor Red
