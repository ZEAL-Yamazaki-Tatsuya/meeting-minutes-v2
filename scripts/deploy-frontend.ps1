# Frontend build and deploy script (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "Starting frontend deployment..." -ForegroundColor Green
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

Write-Host "Environment: $ENVIRONMENT" -ForegroundColor Cyan
Write-Host "App Name: $APP_NAME" -ForegroundColor Cyan
Write-Host "Region: $($env:AWS_REGION)" -ForegroundColor Cyan
Write-Host ""

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location frontend

# Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm ci
}

# Set environment variables (required for build)
if (-not $env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL = "" }
if (-not $env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL = "" }
if (-not $env:NEXT_PUBLIC_COGNITO_USER_POOL_ID) { $env:NEXT_PUBLIC_COGNITO_USER_POOL_ID = "" }
if (-not $env:NEXT_PUBLIC_COGNITO_CLIENT_ID) { $env:NEXT_PUBLIC_COGNITO_CLIENT_ID = "" }
if (-not $env:NEXT_PUBLIC_AWS_REGION) { $env:NEXT_PUBLIC_AWS_REGION = $env:AWS_REGION }

Write-Host ""
Write-Host "Build environment variables:" -ForegroundColor Cyan
Write-Host "  NEXT_PUBLIC_API_URL: $env:NEXT_PUBLIC_API_URL" -ForegroundColor Gray
Write-Host "  NEXT_PUBLIC_COGNITO_USER_POOL_ID: $env:NEXT_PUBLIC_COGNITO_USER_POOL_ID" -ForegroundColor Gray
Write-Host "  NEXT_PUBLIC_COGNITO_CLIENT_ID: $env:NEXT_PUBLIC_COGNITO_CLIENT_ID" -ForegroundColor Gray
Write-Host "  NEXT_PUBLIC_AWS_REGION: $env:NEXT_PUBLIC_AWS_REGION" -ForegroundColor Gray
Write-Host ""

# Run build
Write-Host "Building Next.js application..." -ForegroundColor Yellow
npm run build

# Check build result
if (-not (Test-Path "out")) {
    Write-Host "[ERROR] Build failed (out directory not found)" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Frontend build completed" -ForegroundColor Green
Write-Host ""

# CDK deploy
Set-Location ..
Write-Host "Deploying to CloudFront and S3..." -ForegroundColor Yellow
npx cdk deploy "$APP_NAME-frontend-$ENVIRONMENT" --require-approval never

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] CDK deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Deployment completed!" -ForegroundColor Green
Write-Host ""

# Get CloudFront URL
try {
    $DISTRIBUTION_DOMAIN = aws cloudformation describe-stacks `
        --stack-name "$APP_NAME-frontend-$ENVIRONMENT" `
        --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" `
        --output text `
        --region $env:AWS_REGION 2>&1

    if ($LASTEXITCODE -eq 0 -and $DISTRIBUTION_DOMAIN) {
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "Frontend URL: https://$DISTRIBUTION_DOMAIN" -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
    }
} catch {
    Write-Host "[WARN] Could not retrieve CloudFront URL" -ForegroundColor Yellow
}

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Access the frontend URL above" -ForegroundColor White
Write-Host "  2. Update Cognito callback URLs if needed" -ForegroundColor White
Write-Host ""
