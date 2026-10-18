<#
.SYNOPSIS
  Saves your Anthropic API key to .env.local (turns on the Schedule Helper).

.DESCRIPTION
  The key is SECRET, so the prompt hides what you type and the key is never
  printed. It only goes into .env.local, which git ignores. Get a key at
  console.anthropic.com > API Keys > Create Key. The script checks the key
  with Anthropic before saving it. Never paste a key into a chat, an email
  or a commit.

.EXAMPLE
  From the Planner folder:
    powershell -ExecutionPolicy Bypass -File scripts\add-anthropic-key.ps1
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Paste your Anthropic API key (right-click to paste; it stays hidden), then press Enter."
$secure = Read-Host "API key" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()

if (-not ($key -like "sk-ant-*")) {
  Write-Host "That doesn't look like an Anthropic key (they start with sk-ant-)." -ForegroundColor Red
  exit 1
}

# Don't guess from the prefix (formats change): ask Anthropic. Listing the
# available models is free, and only works with a valid API key.
Write-Host "Checking the key with Anthropic..."
# Windows PowerShell 5.1 may default to old TLS versions; the API needs TLS 1.2+.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
try {
  $null = Invoke-RestMethod -Uri "https://api.anthropic.com/v1/models" -Headers @{
    "x-api-key"         = $key
    "anthropic-version" = "2023-06-01"
  } -Method Get
  Write-Host "The key works." -ForegroundColor Green
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 401 -or $status -eq 403) {
    Write-Host "Anthropic rejected that key ($status). Make sure it's from console.anthropic.com > API Keys" -ForegroundColor Red
    Write-Host "and that it hasn't been deleted. Nothing was saved."
    exit 1
  }
  Write-Host "Couldn't check the key right now ($($_.Exception.Message)). Saving it anyway." -ForegroundColor Yellow
}

$envPath = Join-Path $root ".env.local"
$lines = @()
if (Test-Path $envPath) {
  $lines = @(Get-Content $envPath | Where-Object {
      $_ -notmatch '^\s*ANTHROPIC_API_KEY\s*=' -and $_ -notmatch '^# Schedule Helper'
    })
}
$lines += "# Schedule Helper (secret, server-only)"
$lines += "ANTHROPIC_API_KEY=`"${key}`""
[IO.File]::WriteAllLines($envPath, [string[]]$lines)

Write-Host "Saved to .env.local (ending in ...$($key.Substring($key.Length - 4)))." -ForegroundColor Green
Write-Host "Restart the app (Ctrl+C, then npm.cmd run dev) and open the Helper tab."
