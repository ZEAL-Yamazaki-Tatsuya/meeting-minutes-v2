# Verify that resources have proper tags

Write-Host "=== Verifying Resource Tags ===" -ForegroundColor Cyan
Write-Host ""

$appName = "meeting-minutes-generator"
$env = "dev"

# Check S3 Bucket Tags
Write-Host "Checking S3 Bucket Tags..." -ForegroundColor Green
$inputBucket = "$appName-input-$env-490030480543"
aws s3api get-bucket-tagging --bucket $inputBucket --region ap-northeast-1 --output table 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Input Bucket: Tags found" -ForegroundColor Yellow
} else {
    Write-Host "  Input Bucket: No tags or error" -ForegroundColor Red
}

Write-Host ""

# Check DynamoDB Table Tags
Write-Host "Checking DynamoDB Table Tags..." -ForegroundColor Green
$tableName = "$appName-jobs-$env"
aws dynamodb list-tags-of-resource --resource-arn "arn:aws:dynamodb:ap-northeast-1:490030480543:table/$tableName" --region ap-northeast-1 --output table 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  DynamoDB Table: Tags found" -ForegroundColor Yellow
} else {
    Write-Host "  DynamoDB Table: No tags or error" -ForegroundColor Red
}

Write-Host ""

# Check Lambda Function Tags
Write-Host "Checking Lambda Function Tags..." -ForegroundColor Green
$functionName = "$appName-upload-handler-$env"
aws lambda list-tags --resource "arn:aws:lambda:ap-northeast-1:490030480543:function:$functionName" --region ap-northeast-1 --output table 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Lambda Function: Tags found" -ForegroundColor Yellow
} else {
    Write-Host "  Lambda Function: No tags or error" -ForegroundColor Red
}

Write-Host ""

# Check Cognito User Pool Tags
Write-Host "Checking Cognito User Pool Tags..." -ForegroundColor Green
$userPoolId = "ap-northeast-1_L8fRgd77r"
aws cognito-idp list-tags-for-resource --resource-arn "arn:aws:cognito-idp:ap-northeast-1:490030480543:userpool/$userPoolId" --region ap-northeast-1 --output table 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Cognito User Pool: Tags found" -ForegroundColor Yellow
} else {
    Write-Host "  Cognito User Pool: No tags or error" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: Tags are automatically applied by CDK to all resources" -ForegroundColor Cyan
Write-Host "Do NOT edit CloudFormation stack tags manually!" -ForegroundColor Yellow
Write-Host ""
Write-Host "To use tags for cost tracking:" -ForegroundColor Cyan
Write-Host "1. Go to Billing Console > Cost Allocation Tags" -ForegroundColor Blue
Write-Host "2. Activate the tags (do not edit them)" -ForegroundColor Blue
Write-Host "3. Wait 24 hours for cost data to appear" -ForegroundColor Blue
