[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$OutputPath,
  [string]$BuildImage = 'public.ecr.aws/lambda/nodejs:24'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'package-lock.json'))) { throw 'Canonical package lock is missing.' }
if ([IO.Path]::GetExtension($OutputPath) -ne '.zip') { throw 'OutputPath must end in .zip.' }
$output = [IO.Path]::GetFullPath($OutputPath)
if ($output.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Lambda artifact must be written outside the repository.'
}
docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable; no package was created.' }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('secureride-lambda-' + [guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path $stage | Out-Null
  $null = robocopy $root $stage /E /XD .git node_modules dist coverage .codex .agents /XF .env '*.log' '*.zip'
  if ($LASTEXITCODE -ge 8) { throw "Release staging failed with robocopy exit code $LASTEXITCODE" }
  if (Get-ChildItem -LiteralPath $stage -Directory -Recurse -Filter node_modules) { throw 'Windows node_modules entered the staging tree.' }
  $mount = $stage.Replace('\','/')
  docker pull $BuildImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not obtain the approved Lambda build image.' }
  $digest = docker image inspect $BuildImage --format '{{index .RepoDigests 0}}'
  if ($LASTEXITCODE -ne 0 -or -not $digest) { throw 'Build image digest is unavailable.' }
  docker run --rm --platform linux/amd64 --entrypoint /bin/bash -v "${mount}:/var/task" $BuildImage -lc @'
set -euo pipefail
cd /var/task
microdnf install -y file findutils >/dev/null
npm ci
npm run build --workspace @lets-secureride-ai/contracts
npm run build --workspace @lets-secureride-ai/server
npm prune --omit=dev
node -e "const a=require('argon2');a.hash('lambda-smoke-password').then(h=>a.verify(h,'lambda-smoke-password')).then(ok=>{if(!ok)process.exit(1)})"
node -e "require('sharp')({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer().then(b=>{if(!b.length)process.exit(1)})"
find node_modules -type f \( -name '*.node' -o -name 'sharp-*' \) -print0 | xargs -0 -r file | grep -q 'ELF 64-bit LSB.*x86-64'
'@
  if ($LASTEXITCODE -ne 0) { throw 'Linux build or native dependency verification failed.' }
  $secretPattern = '(AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]+|mongodb\+srv://[^\s]+:[^\s]+@|whsec_[A-Za-z0-9]{16,})'
  $secretHit = $false
  foreach ($file in Get-ChildItem -LiteralPath $stage -File -Recurse -Force) {
    if ($file.Name -in @('.env', '.env.example') -or $file.FullName -match '\\node_modules\\|\\dist\\|\\tests?\\') {
      continue
    }
    if (Select-String -LiteralPath $file.FullName -Pattern $secretPattern -Quiet) {
      $secretHit = $true
      break
    }
  }
  if ($secretHit) { throw 'Potential secret pattern detected; values were not printed.' }
  if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $output -CompressionLevel Optimal
  $compressed = (Get-Item -LiteralPath $output).Length
  $uncompressed = (Get-ChildItem -LiteralPath $stage -File -Recurse | Measure-Object Length -Sum).Sum
  if ($compressed -gt 50MB) { throw 'Compressed package exceeds the 50 MB direct-upload limit.' }
  if ($uncompressed -gt 250MB) { throw 'Uncompressed package exceeds the 250 MB Lambda limit.' }
  $outDirectory = ([IO.Path]::GetDirectoryName($output)).Replace('\','/')
  $zipName = [IO.Path]::GetFileName($output)
  $verifyScript = @"
set -euo pipefail
microdnf install -y unzip >/dev/null
mkdir /tmp/reopen
unzip -q '/artifact/$zipName' -d /tmp/reopen
cd /tmp/reopen
node -e "const a=require('argon2');a.hash('lambda-reopen').then(h=>a.verify(h,'lambda-reopen')).then(ok=>{if(!ok)process.exit(1)})"
node -e "require('sharp')({create:{width:2,height:2,channels:3,background:'blue'}}).webp().toBuffer().then(b=>{if(!b.length)process.exit(1)})"
"@
  docker run --rm --platform linux/amd64 --entrypoint /bin/bash -v "${outDirectory}:/artifact:ro" $BuildImage -lc $verifyScript
  if ($LASTEXITCODE -ne 0) { throw 'Clean-container artifact verification failed.' }
  $zipHash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash
  Write-Output "BUILD_IMAGE_DIGEST $digest"
  Write-Output "ZIP_SHA256 $zipHash"
  Write-Output "PACKAGE_BYTES compressed=$compressed uncompressed=$uncompressed"
  Write-Output "LAMBDA_PACKAGE_READY $output"
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
