# Check costs filtered by Application tags

Write-Host "=== Cost Report by Application Tags ===" -ForegroundColor Cyan
Write-Host ""

$startDate = (Get-Date -Day 1).ToString("yyyy-MM-dd")
$endDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

Write-Host "Period: $startDate to $endDate" -ForegroundColor Yellow
Write-Host "Application: meeting-minutes-generator" -ForegroundColor Yellow
Write-Host ""

# Total cost for this application
Write-Host "Total Cost (Application: meeting-minutes-generator):" -ForegroundColor Green

$filter = @"
{
  "Tags": {
    "Key": "Application",
    "Values": ["meeting-minutes-generator"]
  }
}
"@

$filter | Out-File -FilePath "temp-filter.json" -Encoding UTF8

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --filter file://temp-filter.json `
    --region us-east-1 `
    --query "ResultsByTime[0].Total.UnblendedCost.{Amount:Amount,Unit:Unit}" `
    --output table

Write-Host ""

# Cost by Stack (Storage, Auth, Compute, Frontend)
Write-Host "Cost by Stack:" -ForegroundColor Green

$filter2 = @"
{
  "And": [
    {
      "Tags": {
        "Key": "Application",
        "Values": ["meeting-minutes-generator"]
      }
    }
  ]
}
"@

$filter2 | Out-File -FilePath "temp-filter2.json" -Encoding UTF8

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --filter file://temp-filter2.json `
    --group-by Type=TAG,Key=Stack `
    --region us-east-1 `
    --query "ResultsByTime[0].Groups[*].[Keys[0], Metrics.UnblendedCost.Amount]" `
    --output table

Write-Host ""

# Cost by Environment
Write-Host "Cost by Environment:" -ForegroundColor Green

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --filter file://temp-filter2.json `
    --group-by Type=TAG,Key=Environment `
    --region us-east-1 `
    --query "ResultsByTime[0].Groups[*].[Keys[0], Metrics.UnblendedCost.Amount]" `
    --output table

Write-Host ""

# Cleanup
Remove-Item "temp-filter.json" -ErrorAction SilentlyContinue
Remove-Item "temp-filter2.json" -ErrorAction SilentlyContinue

Write-Host "Note: Tag-based cost allocation may take 24-48 hours to appear" -ForegroundColor Yellow
Write-Host ""
Write-Host "To enable Cost Allocation Tags:" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.aws.amazon.com/billing/home#/tags" -ForegroundColor Blue
Write-Host "2. Activate these tags: Application, Environment, Stack, Component" -ForegroundColor Blue
Write-Host "3. Wait 24 hours for data to appear" -ForegroundColor Blue
