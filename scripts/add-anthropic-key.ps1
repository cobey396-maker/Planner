<#
.SYNOPSIS
  Saves your Anthropic API key to .env.local (turns on the Schedule Helper).

.DESCRIPTION
  The key is SECRET, so the prompt hides what you type and the key is never
  printed. It only goes into .env.local, which git ignores. Get a key at
  console.anthropic.com > API Keys > Create Key. Real API keys start with
  "sk-ant-api". Never paste a key into a chat, an email or a commit.

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

if ($key -like "sk-ant-api*") {
  # The right kind of key.
} elseif ($key -like "sk-ant-*") {
  Write-Host "That isn't an API key (API keys start with sk-ant-api)." -ForegroundColor Red
  Write-Host "Keys starting with sk-ant-usr / sk-ant-oat belong to your Claude login, not the API."
  Write-Host "If you shared one anywhere, sign out of all sessions on claude.ai to cancel it."
  Write-Host "Then create an API key at console.anthropic.com > API Keys."
  exit 1
} else {
  Write-Host "That doesn't look like an Anthropic API key (it should start with sk-ant-api)." -ForegroundColor Red
  exit 1
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
