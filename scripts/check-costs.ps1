# AWS Cost Explorer API - Check current costs

param(
    [string]$Region = "ap-northeast-1"
)

Write-Host "=== AWS Cost Report ===" -ForegroundColor Cyan
Write-Host ""

# Get start and end dates for current month
$startDate = (Get-Date -Day 1).ToString("yyyy-MM-dd")
$endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

Write-Host "Period: $startDate to $endDate" -ForegroundColor Yellow
Write-Host ""

# Get total cost for current month
Write-Host "Total Cost (Month-to-Date):" -ForegroundColor Green
aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --region us-east-1 `
    --query "ResultsByTime[0].Total.UnblendedCost.{Amount:Amount,Unit:Unit}" `
    --output table

Write-Host ""

# Get cost by service
Write-Host "Cost by Service (Top 10):" -ForegroundColor Green
aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --group-by Type=DIMENSION,Key=SERVICE `
    --region us-east-1 `
    --query "ResultsByTime[0].Groups | sort_by(@, &Metrics.UnblendedCost.Amount) | reverse(@) | [0:10].[Keys[0], Metrics.UnblendedCost.Amount]" `
    --output table

Write-Host ""

# Get daily costs for last 7 days
Write-Host "Daily Costs (Last 7 Days):" -ForegroundColor Green
$sevenDaysAgo = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
$today = (Get-Date).ToString("yyyy-MM-dd")

aws ce get-cost-and-usage `
    --time-period Start=$sevenDaysAgo,End=$today `
    --granularity DAILY `
    --metrics "UnblendedCost" `
    --region us-east-1 `
    --query "ResultsByTime[*].[TimePeriod.Start, Total.UnblendedCost.Amount]" `
    --output table

Write-Host ""
Write-Host "For detailed analysis, visit AWS Cost Explorer:" -ForegroundColor Cyan
Write-Host "https://console.aws.amazon.com/cost-management/home" -ForegroundColor Blue
Write-Host ""
Write-Host "Tip: Enable Cost Allocation Tags for better tracking:" -ForegroundColor Yellow
Write-Host "https://console.aws.amazon.com/billing/home#/tags" -ForegroundColor Blue
