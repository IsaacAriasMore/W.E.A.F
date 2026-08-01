param(
  [string]$OutputDirectory = (Join-Path $env:TEMP 'weaf-database-backups')
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$targetRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($targetRoot.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Backups must be stored outside the Git workspace.'
}

New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $targetRoot "weaf-local-$stamp.sql"

& npx.cmd supabase db dump --local --file $backup
if ($LASTEXITCODE -ne 0) { throw 'Supabase local dump failed.' }
$file = Get-Item -LiteralPath $backup
if ($file.Length -le 0) { throw 'The generated backup is empty.' }

$hash = Get-FileHash -LiteralPath $backup -Algorithm SHA256
$hashLine = "$($hash.Hash.ToLowerInvariant())  $($file.Name)"
Set-Content -LiteralPath "$backup.sha256" -Value $hashLine -Encoding ascii

Write-Host "Local backup created outside Git: $backup"
Write-Host "Bytes: $($file.Length)"
Write-Host "SHA-256 manifest: $backup.sha256"
