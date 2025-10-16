# Deploy frontend using AWS Amplify Hosting

$ErrorActionPreference = "Stop"

Write-Host "Deploying frontend with AWS Amplify Hosting..." -ForegroundColor Green
Write-Host ""

# Load .env file if it exists
if (Test-Path ".env") {
    Write-Host "Loading .env file..." -ForegroundColor Cyan
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

# Check environment variables
if (-not $env:AWS_ACCOUNT_ID) {
    Write-Host "[ERROR] AWS_ACCOUNT_ID is not set" -ForegroundColor Red
    exit 1
}

if (-not $env:AWS_REGION) {
    Write-Host "[ERROR] AWS_REGION is not set" -ForegroundColor Red
    exit 1
}

$ENVIRONMENT = if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }
$APP_NAME = if ($env:APP_NAME) { $env:APP_NAME } else { "meeting-minutes-generator" }

# Set USE_AMPLIFY=true
$env:USE_AMPLIFY = "true"

Write-Host "Environment: $ENVIRONMENT" -ForegroundColor Cyan
Write-Host "App Name: $APP_NAME" -ForegroundColor Cyan
Write-Host "Region: $($env:AWS_REGION)" -ForegroundColor Cyan
Write-Host "Deployment Method: AWS Amplify Hosting" -ForegroundColor Cyan
Write-Host ""

# Deploy Amplify stack
Write-Host "Deploying Amplify stack..." -ForegroundColor Yellow
npx cdk deploy "$APP_NAME-amplify-$ENVIRONMENT" --require-approval never

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] CDK deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Deployment completed!" -ForegroundColor Green
Write-Host ""

# Get Amplify App ID and URL
try {
    $APP_ID = aws cloudformation describe-stacks `
        --stack-name "$APP_NAME-amplify-$ENVIRONMENT" `
        --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppId'].OutputValue" `
        --output text `
        --region $env:AWS_REGION 2>&1

    $APP_URL = aws cloudformation describe-stacks `
        --stack-name "$APP_NAME-amplify-$ENVIRONMENT" `
        --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppUrl'].OutputValue" `
        --output text `
        --region $env:AWS_REGION 2>&1

    if ($LASTEXITCODE -eq 0 -and $APP_ID -and $APP_URL) {
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "Amplify App ID: $APP_ID" -ForegroundColor Green
        Write-Host "Frontend URL: $APP_URL" -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "To deploy your code to Amplify:" -ForegroundColor Yellow
        Write-Host "  1. Connect your GitHub repository in Amplify Console" -ForegroundColor White
        Write-Host "  2. Or use manual deployment:" -ForegroundColor White
        Write-Host "     cd frontend && zip -r ../frontend.zip ." -ForegroundColor Gray
        Write-Host "     aws amplify create-deployment --app-id $APP_ID --branch-name $ENVIRONMENT" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "[WARN] Could not retrieve Amplify information" -ForegroundColor Yellow
}

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open Amplify Console to configure your app" -ForegroundColor White
Write-Host "  2. Connect GitHub repository for auto-deployment" -ForegroundColor White
Write-Host "  3. Or use manual deployment with ZIP file" -ForegroundColor White
Write-Host ""
