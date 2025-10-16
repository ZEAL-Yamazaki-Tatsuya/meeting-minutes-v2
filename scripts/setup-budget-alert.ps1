# Setup AWS Budget Alert
# This script creates a monthly budget with email notifications

param(
    [Parameter(Mandatory=$true)]
    [decimal]$MonthlyBudget,
    
    [Parameter(Mandatory=$true)]
    [string]$EmailAddress,
    
    [string]$BudgetName = "meeting-minutes-generator-budget"
)

Write-Host "=== Setting up AWS Budget Alert ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Budget Name: $BudgetName" -ForegroundColor Yellow
Write-Host "Monthly Budget: `$$MonthlyBudget USD" -ForegroundColor Yellow
Write-Host "Email: $EmailAddress" -ForegroundColor Yellow
Write-Host ""

# Create budget configuration
$budgetConfig = @"
{
  "BudgetName": "$BudgetName",
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY",
  "BudgetLimit": {
    "Amount": "$MonthlyBudget",
    "Unit": "USD"
  },
  "CostFilters": {
    "TagKeyValue": ["user:Application`$meeting-minutes-generator"]
  },
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false,
    "IncludeRefund": false,
    "IncludeCredit": false,
    "IncludeUpfront": true,
    "IncludeRecurring": true,
    "IncludeOtherSubscription": true,
    "IncludeSupport": true,
    "IncludeDiscount": true,
    "UseAmortized": false
  }
}
"@

# Create notification configuration
$notificationConfig = @"
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "$EmailAddress"
      }
    ]
  },
  {
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "$EmailAddress"
      }
    ]
  }
]
"@

# Save to temp files
$budgetConfig | Out-File -FilePath "temp-budget.json" -Encoding UTF8
$notificationConfig | Out-File -FilePath "temp-notifications.json" -Encoding UTF8

Write-Host "Creating budget..." -ForegroundColor Green

# Create budget
aws budgets create-budget `
    --account-id (aws sts get-caller-identity --query Account --output text) `
    --budget file://temp-budget.json `
    --notifications-with-subscribers file://temp-notifications.json `
    --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Budget alert created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You will receive email notifications when:" -ForegroundColor Cyan
    Write-Host "  - Actual cost exceeds 80% of budget" -ForegroundColor Yellow
    Write-Host "  - Forecasted cost exceeds 100% of budget" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "View your budgets at:" -ForegroundColor Cyan
    Write-Host "https://console.aws.amazon.com/billing/home#/budgets" -ForegroundColor Blue
} else {
    Write-Host ""
    Write-Host "Failed to create budget. Error code: $LASTEXITCODE" -ForegroundColor Red
}

# Cleanup temp files
Remove-Item "temp-budget.json" -ErrorAction SilentlyContinue
Remove-Item "temp-notifications.json" -ErrorAction SilentlyContinue
