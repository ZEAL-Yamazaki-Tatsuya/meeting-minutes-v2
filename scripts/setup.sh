#!/bin/bash

# Setup script for Meeting Minutes Generator
# This script helps with initial project setup

set -e

echo "=========================================="
echo "Meeting Minutes Generator - Setup Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. You'll need it for deployment."
    echo "   Install from: https://aws.amazon.com/cli/"
else
    echo "✅ AWS CLI version: $(aws --version)"
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK is not installed."
    read -p "Would you like to install it globally? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g aws-cdk
        echo "✅ AWS CDK installed"
    else
        echo "⚠️  You'll need to install AWS CDK manually: npm install -g aws-cdk"
    fi
else
    echo "✅ AWS CDK version: $(cdk --version)"
fi

echo ""
echo "Installing project dependencies..."
npm install

echo ""
echo "✅ Dependencies installed"

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and set your AWS account details:"
    echo "   - AWS_ACCOUNT_ID"
    echo "   - AWS_REGION"
    echo "   - Other configuration values"
else
    echo ""
    echo "✅ .env file already exists"
fi

echo ""
echo "Building project..."
npm run build

echo ""
echo "✅ Project built successfully"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your AWS account details"
echo "2. Configure AWS CLI: aws configure"
echo "3. Bootstrap CDK (first time only):"
echo "   cdk bootstrap aws://ACCOUNT-ID/REGION"
echo "4. Deploy infrastructure:"
echo "   npm run deploy"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
echo ""
