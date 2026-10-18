<#
.SYNOPSIS
  Adds your Supabase URL and publishable key to .env.local (turns on real accounts).

.DESCRIPTION
  Asks ONLY for the publishable key (Supabase > Project Settings > API Keys).
  It is a public value, so the prompt is visible. Your database settings in
  .env.local are left exactly as they are. Afterwards it checks that the
  database connection still works.

.EXAMPLE
  From the Planner folder:
    powershell -ExecutionPolicy Bypass -File scripts\add-supabase-key.ps1
#>
param(
  [string]$ProjectRef = "lqpkwzifahzuuawsqxad"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$npm = "npm"
if ($env:OS -eq "Windows_NT") { $npm = "npm.cmd" }

$key = $env:SUPABASE_PUBLISHABLE_KEY
if (-not $key) {
  Write-Host "Paste your Supabase publishable key (right-click to paste), then press Enter."
  Write-Host "It starts with sb_publishable_ (or eyJ for an older 'anon' key)."
  $key = (Read-Host "Publishable key").Trim()
}

# Never let a SECRET key end up in a NEXT_PUBLIC_ variable: those are sent to
# every visitor's browser, and a secret key bypasses all security rules.
if ($key -like "sb_secret_*") {
  Write-Host "That's the SECRET key. Don't use it here (and don't share it)." -ForegroundColor Red
  Write-Host "Copy the key labeled 'Publishable key' instead."
  exit 1
}
if (-not ($key -like "sb_publishable_*" -or $key -like "eyJ*")) {
  Write-Host "That doesn't look like a publishable key (sb_publishable_... or eyJ...)." -ForegroundColor Red
  exit 1
}

$envPath = Join-Path $root ".env.local"
$lines = @()
if (Test-Path $envPath) {
  $lines = @(Get-Content $envPath | Where-Object {
      $_ -notmatch '^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)\s*=' -and
      $_ -notmatch '^# Supabase Auth'
    })
}
$lines += "# Supabase Auth (public values)"
$lines += "NEXT_PUBLIC_SUPABASE_URL=`"https://${ProjectRef}.supabase.co`""
$lines += "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`"${key}`""
[IO.File]::WriteAllLines($envPath, [string[]]$lines)
Write-Host "Saved the key to .env.local." -ForegroundColor Green

# Make sure the database settings still work (they may have been overwritten
# if a key was typed into a password prompt earlier).
Write-Host ""
Write-Host "Checking the database connection..."
& $npm run db:status
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "The database connection failed. Your database password in .env.local is" -ForegroundColor Yellow
  Write-Host "probably wrong. Fix it by running (it asks for the password, then this key):"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1 -SkipInstall -SkipMigrate"
  exit 1
}

Write-Host ""
Write-Host "All good! Restart the app (Ctrl+C, then npm.cmd run dev) to turn on accounts." -ForegroundColor Green
