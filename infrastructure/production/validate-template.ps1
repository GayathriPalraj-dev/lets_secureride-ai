[CmdletBinding()]
param([switch]$AwsValidation)
$ErrorActionPreference = 'Stop'
$template = Join-Path $PSScriptRoot 'main.yaml'
if (-not (Test-Path -LiteralPath $template)) { throw 'Production template is missing.' }
$text = Get-Content -LiteralPath $template -Raw
foreach ($required in 'AWS::Lambda::Function','AWS::ApiGatewayV2::Api','AWS::CloudFront::Distribution','AWS::S3::Bucket','ssm:GetParameter','nodejs24.x','ReservedConcurrentExecutions: 2','RetentionInDays: 7') {
  if (-not $text.Contains($required)) { throw "Template requirement missing: $required" }
}
foreach ($prohibited in 'AWS::EC2::','AWS::SecretsManager::','AWS::WAF','AWS::ECR::','ProvisionedConcurrency','GetParametersByPath','ssm:PutParameter') {
  if ($text.Contains($prohibited)) { throw "Prohibited template resource or permission found: $prohibited" }
}
if ($text -match '(?i)(AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]+|mongodb\+srv://[^\s]+:[^\s]+@)') {
  throw 'Potential credential material found in template.'
}
if ($AwsValidation) {
  aws cloudformation validate-template --template-body ("file://" + $template) --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AWS CloudFormation validation failed.' }
  Write-Output 'AWS_TEMPLATE_VALIDATION_PASS'
}
Write-Output 'LOCAL_TEMPLATE_VALIDATION_PASS'
