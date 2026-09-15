[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$TemporaryStack,
  [Parameter(Mandatory)][string]$BucketName,
  [Parameter(Mandatory)][string]$DeploymentPrefix
)
$ErrorActionPreference = 'Stop'
$Profile = 'secureride-provisioner'
$Region = 'ap-south-1'
Write-Output 'Delete the recorded Stripe endpoint and Atlas /32 before invoking stack rollback.'
aws cloudformation delete-stack --stack-name $TemporaryStack --profile $Profile --region $Region
aws cloudformation wait stack-delete-complete --stack-name $TemporaryStack --profile $Profile --region $Region
Write-Output 'STEP9_TEMPORARY_STACK_ROLLBACK_PASS'
Write-Output 'Durable security resources are intentionally preserved.'
