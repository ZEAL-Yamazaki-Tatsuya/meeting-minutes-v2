# Check costs for all AWS services including Bedrock, Amplify, API Gateway

Write-Host "=== Detailed Service Cost Report ===" -ForegroundColor Cyan
Write-Host ""

$startDate = (Get-Date -Day 1).ToString("yyyy-MM-dd")
$endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

Write-Host "Period: $startDate to $endDate" -ForegroundColor Yellow
Write-Host ""

# Get all services with costs (not just top 10)
Write-Host "All Services with Usage:" -ForegroundColor Green
Write-Host ""

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --group-by Type=DIMENSION,Key=SERVICE `
    --region us-east-1 `
    --query "ResultsByTime[0].Groups[*].[Keys[0], Metrics.UnblendedCost.Amount]" `
    --output table

Write-Host ""
Write-Host "Key Services for this Application:" -ForegroundColor Cyan
Write-Host "  - Amazon Bedrock: AI model inference" -ForegroundColor Yellow
Write-Host "  - AWS Amplify: Frontend hosting and CI/CD" -ForegroundColor Yellow
Write-Host "  - Amazon API Gateway: REST API" -ForegroundColor Yellow
Write-Host "  - Amazon Transcribe: Audio transcription" -ForegroundColor Yellow
Write-Host "  - AWS Lambda: Serverless compute" -ForegroundColor Yellow
Write-Host "  - Amazon S3: File storage" -ForegroundColor Yellow
Write-Host "  - Amazon DynamoDB: Database" -ForegroundColor Yellow
Write-Host "  - Amazon Cognito: Authentication" -ForegroundColor Yellow
Write-Host "  - AWS Step Functions: Workflow orchestration" -ForegroundColor Yellow
Write-Host ""

# Check specific high-cost services
Write-Host "Checking specific services..." -ForegroundColor Green
Write-Host ""

$services = @(
    "Amazon Bedrock",
    "AWS Amplify",
    "Amazon API Gateway",
    "Amazon Transcribe",
    "AWS Lambda",
    "AWS Step Functions",
    "Amazon Cognito"
)

foreach ($service in $services) {
    Write-Host "  $service" -ForegroundColor Cyan -NoNewline
    $cost = aws ce get-cost-and-usage `
        --time-period Start=$startDate,End=$endDate `
        --granularity MONTHLY `
        --metrics "UnblendedCost" `
        --filter "{`"Dimensions`":{`"Key`":`"SERVICE`",`"Values`":[`"$service`"]}}" `
        --region us-east-1 `
        --query "ResultsByTime[0].Total.UnblendedCost.Amount" `
        --output text 2>$null
    
    if ($cost) {
        Write-Host " : `$$cost USD" -ForegroundColor Yellow
    } else {
        Write-Host " : $0.00 USD (no usage)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Note: Costs may take up to 24 hours to appear in Cost Explorer" -ForegroundColor Yellow
