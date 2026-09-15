[CmdletBinding()]
param([string]$OutputPath)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputPath) { $OutputPath = Join-Path ([IO.Path]::GetTempPath()) 'secureride-release.zip' }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('secureride-release-' + [guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path $stage | Out-Null
  $null = robocopy $root $stage /E /XD .git node_modules dist coverage .codex .agents /XF .env '*.log' '*.zip'
  if ($LASTEXITCODE -ge 8) { throw "Release staging failed with robocopy exit code $LASTEXITCODE" }
  Push-Location $stage
  try {
    npm ci
    npm run build
    npm prune --omit=dev
  } finally { Pop-Location }
  if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $OutputPath -CompressionLevel Optimal
  Write-Output "RELEASE_READY $OutputPath"
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
