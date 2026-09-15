[CmdletBinding()]
param([Parameter(Mandatory)][string]$BucketName)
$ErrorActionPreference = 'Stop'
$Profile = 'secureride-provisioner'
$Region = 'ap-south-1'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Run = [guid]::NewGuid().ToString('N')
$DeploymentKey = "deployment/$Run/app.zip"
$TransformerKey = "deployment/$Run/transformer.zip"
$Temp = Join-Path ([IO.Path]::GetTempPath()) "lets-secureride-step9-$Run"
New-Item -ItemType Directory -Path $Temp | Out-Null
try {
  git -C $Root archive --format=zip --output=(Join-Path $Temp 'app.zip') HEAD
  Compress-Archive -LiteralPath (Join-Path $PSScriptRoot 'event-transformer.mjs') -DestinationPath (Join-Path $Temp 'transformer.zip')
  aws s3api put-object --bucket $BucketName --key $DeploymentKey --body (Join-Path $Temp 'app.zip') --server-side-encryption AES256 --profile $Profile --region $Region --output json | Out-Null
  aws s3api put-object --bucket $BucketName --key $TransformerKey --body (Join-Path $Temp 'transformer.zip') --server-side-encryption AES256 --profile $Profile --region $Region --output json | Out-Null
  Write-Output 'STEP9_ARTIFACT_UPLOAD_PASS'
} finally {
  Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
