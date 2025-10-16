# Get environment variables from backend stacks

$ErrorActionPreference = "Stop"

Write-Host "Getting environment variables from backend stacks..." -ForegroundColor Green
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
if (-not $env:AWS_REGION) {
    $env:AWS_REGION = "us-east-1"
    Write-Host "WARNING: AWS_REGION not set, using default 'us-east-1'" -ForegroundColor Yellow
}

$ENVIRONMENT = if ($env:ENVIRONMENT) { $env:ENVIRONMENT } else { "dev" }
$APP_NAME = if ($env:APP_NAME) { $env:APP_NAME } else { "meeting-minutes-generator" }

Write-Host "Environment: $ENVIRONMENT" -ForegroundColor Cyan
Write-Host "App Name: $APP_NAME" -ForegroundColor Cyan
Write-Host "Region: $($env:AWS_REGION)" -ForegroundColor Cyan
Write-Host ""

# 1. Get API URL
Write-Host "1. Getting API URL..." -ForegroundColor Yellow
$API_URL = $null
$output = aws cloudformation describe-stacks `
    --stack-name "$APP_NAME-compute-$ENVIRONMENT" `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text `
    --region $env:AWS_REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    $API_URL = $output.Trim()
    if ($API_URL -and $API_URL -ne "None" -and $API_URL -ne "") {
        Write-Host "   [OK] NEXT_PUBLIC_API_URL=$API_URL" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] API URL not found in stack outputs" -ForegroundColor Yellow
        Write-Host "   [TIP] Stack exists but Output 'ApiUrl' is missing" -ForegroundColor Yellow
        $API_URL = $null
    }
} else {
    Write-Host "   [WARN] Stack '$APP_NAME-compute-$ENVIRONMENT' not found" -ForegroundColor Yellow
    Write-Host "   [TIP] Deploy backend first: npm run deploy" -ForegroundColor Yellow
    $API_URL = $null
}

Write-Host ""

# 2. Get Cognito User Pool ID
Write-Host "2. Getting Cognito User Pool ID..." -ForegroundColor Yellow
$USER_POOL_ID = $null
$output = aws cloudformation describe-stacks `
    --stack-name "$APP_NAME-auth-$ENVIRONMENT" `
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
    --output text `
    --region $env:AWS_REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    $USER_POOL_ID = $output.Trim()
    if ($USER_POOL_ID -and $USER_POOL_ID -ne "None" -and $USER_POOL_ID -ne "") {
        Write-Host "   [OK] NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] User Pool ID not found in stack outputs" -ForegroundColor Yellow
        $USER_POOL_ID = $null
    }
} else {
    Write-Host "   [WARN] Stack '$APP_NAME-auth-$ENVIRONMENT' not found" -ForegroundColor Yellow
    Write-Host "   [TIP] Deploy backend first: npm run deploy" -ForegroundColor Yellow
    $USER_POOL_ID = $null
}

Write-Host ""

# 3. Get Cognito Client ID
Write-Host "3. Getting Cognito Client ID..." -ForegroundColor Yellow
$CLIENT_ID = $null
$output = aws cloudformation describe-stacks `
    --stack-name "$APP_NAME-auth-$ENVIRONMENT" `
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" `
    --output text `
    --region $env:AWS_REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    $CLIENT_ID = $output.Trim()
    if ($CLIENT_ID -and $CLIENT_ID -ne "None" -and $CLIENT_ID -ne "") {
        Write-Host "   [OK] NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Client ID not found in stack outputs" -ForegroundColor Yellow
        $CLIENT_ID = $null
    }
} else {
    Write-Host "   [WARN] Stack '$APP_NAME-auth-$ENVIRONMENT' not found" -ForegroundColor Yellow
    Write-Host "   [TIP] Deploy backend first: npm run deploy" -ForegroundColor Yellow
    $CLIENT_ID = $null
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Add these values to your .env file:" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($API_URL) {
    Write-Host "NEXT_PUBLIC_API_URL=$API_URL" -ForegroundColor White
}
if ($USER_POOL_ID) {
    Write-Host "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID" -ForegroundColor White
}
if ($CLIENT_ID) {
    Write-Host "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID" -ForegroundColor White
}
Write-Host "NEXT_PUBLIC_AWS_REGION=$($env:AWS_REGION)" -ForegroundColor White

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Ask if user wants to add to .env file
Write-Host "Do you want to add these values to .env file automatically? (y/N): " -NoNewline -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "Updating .env file..." -ForegroundColor Yellow
    
    # Create .env file if it doesn't exist
    if (-not (Test-Path ".env")) {
        Write-Host "   Creating new .env file from .env.example" -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
    }
    
    # Read existing content
    $envContent = Get-Content ".env" -Raw
    
    if ($API_URL) {
        # Comment out existing NEXT_PUBLIC_API_URL
        $envContent = $envContent -replace "(?m)^(NEXT_PUBLIC_API_URL=.*)", "# `$1"
        # Add new value
        $envContent += "`nNEXT_PUBLIC_API_URL=$API_URL"
    }
    
    if ($USER_POOL_ID) {
        $envContent = $envContent -replace "(?m)^(NEXT_PUBLIC_COGNITO_USER_POOL_ID=.*)", "# `$1"
        $envContent += "`nNEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
    }
    
    if ($CLIENT_ID) {
        $envContent = $envContent -replace "(?m)^(NEXT_PUBLIC_COGNITO_CLIENT_ID=.*)", "# `$1"
        $envContent += "`nNEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
    }
    
    # Add AWS_REGION
    $envContent = $envContent -replace "(?m)^(NEXT_PUBLIC_AWS_REGION=.*)", "# `$1"
    $envContent += "`nNEXT_PUBLIC_AWS_REGION=$($env:AWS_REGION)"
    
    # Write to file
    $envContent | Set-Content ".env" -NoNewline
    
    Write-Host "   [OK] .env file updated" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Please copy the values above to your .env file manually" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   1. Check your .env file" -ForegroundColor White
Write-Host "   2. Deploy frontend: npm run deploy:frontend" -ForegroundColor White
Write-Host ""
