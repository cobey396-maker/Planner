<#
.SYNOPSIS
  One-step Supabase setup for Auto-Planner: writes .env.local and creates the tables.

.DESCRIPTION
  1. Asks for your Supabase database password (typing is hidden).
  2. Writes DATABASE_URL and DIRECT_URL into .env.local (keeping any other
     lines already there). The password is URL-encoded, so special
     characters like @ # / ? % are safe.
  3. Runs `npm install` (generates the Prisma client), then applies the
     migrations with `prisma migrate deploy`, then shows the status.

  Your password is only written to .env.local on this computer, which git
  ignores. It is never printed or sent anywhere except to your database.

.EXAMPLE
  From the Planner folder:
    powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1
#>
param(
  # Your Supabase project's reference id (the part after "postgres." in the connection string).
  [string]$ProjectRef = "lqpkwzifahzuuawsqxad",
  # The pooler host from Supabase's Connect dialog.
  [string]$PoolerHost = "aws-0-us-east-2.pooler.supabase.com",
  # Skip `npm install` if you've already run it.
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Windows uses npm.cmd (npm.ps1 may be blocked by the execution policy).
$npm = "npm"
if ($env:OS -eq "Windows_NT") { $npm = "npm.cmd" }

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

Write-Host "Auto-Planner database setup" -ForegroundColor Green
Write-Host "Project: $ProjectRef  Host: $PoolerHost"

# --- 1. Password ---------------------------------------------------------------
if ($env:SUPABASE_DB_PASSWORD) {
  # Lets CI (or a test) provide it without a prompt.
  $password = $env:SUPABASE_DB_PASSWORD
} else {
  $secure = Read-Host "Supabase database password (typing is hidden)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
if ([string]::IsNullOrEmpty($password)) { throw "No password entered." }

# Percent-encode so characters like @ : / # ? % can't break the URL.
$encoded = [Uri]::EscapeDataString($password)
$dbUser = "postgres.$ProjectRef"

# --- 2. .env.local ---------------------------------------------------------------
Write-Step "Writing .env.local"
$envPath = Join-Path $root ".env.local"
if (Test-Path $envPath) {
  # Keep everything except our own database lines (and their comments),
  # so running the script again replaces them instead of duplicating.
  $lines = @(Get-Content $envPath | Where-Object {
      $_ -notmatch '^\s*(DATABASE_URL|DIRECT_URL)\s*=' -and
      $_ -notmatch '^# (Pooled connection for the app|Connection for migrations)'
    })
} else {
  $lines = @("NEXT_PUBLIC_APP_URL=http://localhost:3002")
}
$lines += "# Pooled connection for the app (transaction pooler)"
$lines += "DATABASE_URL=`"postgresql://${dbUser}:${encoded}@${PoolerHost}:6543/postgres`""
$lines += "# Connection for migrations (session pooler)"
$lines += "DIRECT_URL=`"postgresql://${dbUser}:${encoded}@${PoolerHost}:5432/postgres`""
# WriteAllLines writes UTF-8 without a byte-order mark, which Node expects.
[IO.File]::WriteAllLines($envPath, [string[]]$lines)
$password = $null
$encoded = $null
Write-Host "Saved (password not shown)."

# Safety check: .env.local must never be committed.
if (Get-Command git -ErrorAction SilentlyContinue) {
  git check-ignore -q .env.local
  if ($LASTEXITCODE -ne 0) {
    Write-Warning ".env.local is NOT ignored by git. Do not commit it!"
  }
}

# --- 3. Install, migrate, verify --------------------------------------------------
if (-not $SkipInstall) {
  Write-Step "Installing packages (also generates the Prisma client)"
  & $npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed (see the messages above)." }
}

Write-Step "Creating the tables (prisma migrate deploy)"
& $npm run db:migrate
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "The migration failed. Common causes:" -ForegroundColor Yellow
  Write-Host "  P1000 / authentication failed -> wrong password. Run this script again,"
  Write-Host "        or reset it in Supabase: Project Settings > Database."
  Write-Host "  P1001 / can't reach server    -> check -PoolerHost matches Supabase's Connect"
  Write-Host "        dialog (e.g. aws-0 vs aws-1, and the region)."
  Write-Host "  Paste the error into the chat (it never contains your password)."
  exit 1
}

Write-Step "Checking migration status"
& $npm run db:status

Write-Host ""
Write-Host "Done! In Supabase, open Table Editor: you should see 8 tables, each with RLS enabled." -ForegroundColor Green
