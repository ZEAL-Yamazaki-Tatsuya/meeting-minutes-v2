# Setup script for Meeting Minutes Generator (PowerShell)
# This script helps with initial project setup

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Meeting Minutes Generator - Setup Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed. Please install npm first." -ForegroundColor Red
    exit 1
}

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version
    Write-Host "✅ AWS CLI version: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  AWS CLI is not installed. You'll need it for deployment." -ForegroundColor Yellow
    Write-Host "   Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
}

# Check if CDK is installed
try {
    $cdkVersion = cdk --version
    Write-Host "✅ AWS CDK version: $cdkVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  AWS CDK is not installed." -ForegroundColor Yellow
    $response = Read-Host "Would you like to install it globally? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        npm install -g aws-cdk
        Write-Host "✅ AWS CDK installed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  You'll need to install AWS CDK manually: npm install -g aws-cdk" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host ""
    Write-Host "Creating .env file from template..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "✅ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Please edit .env file and set your AWS account details:" -ForegroundColor Yellow
    Write-Host "   - AWS_ACCOUNT_ID" -ForegroundColor Yellow
    Write-Host "   - AWS_REGION" -ForegroundColor Yellow
    Write-Host "   - Other configuration values" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "Building project..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "✅ Project built successfully" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env file with your AWS account details"
Write-Host "2. Configure AWS CLI: aws configure"
Write-Host "3. Bootstrap CDK (first time only):"
Write-Host "   cdk bootstrap aws://ACCOUNT-ID/REGION"
Write-Host "4. Deploy infrastructure:"
Write-Host "   npm run deploy"
Write-Host ""
Write-Host "For detailed instructions, see DEPLOYMENT.md"
Write-Host ""
