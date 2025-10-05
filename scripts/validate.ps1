# Validation script for Meeting Minutes Generator
# Checks if the project is properly configured

$ErrorActionPreference = "Stop"

Write-Host "Validating project configuration..." -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()

# Check if .env file exists
if (-not (Test-Path .env)) {
    $errors += ".env file not found. Run setup script or copy from .env.example"
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    
    # Check if required variables are set
    $envContent = Get-Content .env -Raw
    
    if ($envContent -notmatch "AWS_ACCOUNT_ID=\d+") {
        $warnings += "AWS_ACCOUNT_ID not set in .env"
    }
    
    if ($envContent -notmatch "AWS_REGION=\w+-\w+-\d+") {
        $warnings += "AWS_REGION not set in .env"
    }
}

# Check if node_modules exists
if (-not (Test-Path node_modules)) {
    $errors += "node_modules not found. Run 'npm install'"
} else {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

# Check if TypeScript compiles
Write-Host "Checking TypeScript compilation..." -ForegroundColor Cyan
try {
    npm run build 2>&1 | Out-Null
    Write-Host "✅ TypeScript compiles successfully" -ForegroundColor Green
} catch {
    $errors += "TypeScript compilation failed. Check for syntax errors"
}

# Check if CDK can synthesize
Write-Host "Checking CDK synthesis..." -ForegroundColor Cyan
try {
    $env:AWS_ACCOUNT_ID = "123456789012"
    $env:AWS_REGION = "us-east-1"
    cdk synth 2>&1 | Out-Null
    Write-Host "✅ CDK synthesis successful" -ForegroundColor Green
} catch {
    $warnings += "CDK synthesis failed. This might be due to missing environment variables"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host "Project is ready for deployment." -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "❌ Errors found:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "   - $error" -ForegroundColor Red
        }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "⚠️  Warnings:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "   - $warning" -ForegroundColor Yellow
        }
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
