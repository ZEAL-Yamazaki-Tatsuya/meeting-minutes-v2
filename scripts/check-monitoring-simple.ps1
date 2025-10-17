# モニタリングスタックの状態確認スクリプト（簡易版）

Write-Host "=== Monitoring Stack Status Check ===" -ForegroundColor Cyan

# Load environment variables from .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    exit 1
}

$environment = [Environment]::GetEnvironmentVariable("ENVIRONMENT", "Process")
$appName = [Environment]::GetEnvironmentVariable("APP_NAME", "Process")
$region = [Environment]::GetEnvironmentVariable("AWS_REGION", "Process")
$stackName = "$appName-monitoring-$environment"

Write-Host "`nConfiguration:" -ForegroundColor Yellow
Write-Host "  Environment: $environment"
Write-Host "  App Name: $appName"
Write-Host "  Stack Name: $stackName"
Write-Host "  Region: $region"

# Check AWS credentials
Write-Host "`n=== AWS Credentials Check ===" -ForegroundColor Cyan
$identity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: AWS credentials are invalid" -ForegroundColor Red
    Write-Host "Please configure AWS credentials with: aws configure" -ForegroundColor Yellow
    exit 1
}
$identityJson = $identity | ConvertFrom-Json
Write-Host "OK: AWS credentials are valid" -ForegroundColor Green
Write-Host "  Account ID: $($identityJson.Account)"

# Check CloudFormation stack
Write-Host "`n=== CloudFormation Stack Check ===" -ForegroundColor Cyan
$stackInfo = aws cloudformation describe-stacks --stack-name $stackName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Monitoring stack is not deployed" -ForegroundColor Red
    Write-Host "`nTo deploy the monitoring stack, run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\deploy-monitoring.ps1" -ForegroundColor Yellow
    exit 1
}

$stack = $stackInfo | ConvertFrom-Json
$stackStatus = $stack.Stacks[0].StackStatus
$creationTime = $stack.Stacks[0].CreationTime

Write-Host "OK: Monitoring stack is deployed" -ForegroundColor Green
Write-Host "  Status: $stackStatus"
Write-Host "  Created: $creationTime"

# Check CloudWatch dashboard
Write-Host "`n=== CloudWatch Dashboard Check ===" -ForegroundColor Cyan
$dashboardName = "$appName-$environment"
$dashboardInfo = aws cloudwatch get-dashboard --dashboard-name $dashboardName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Dashboard not found: $dashboardName" -ForegroundColor Red
} else {
    Write-Host "OK: Dashboard exists: $dashboardName" -ForegroundColor Green
    $dashboardUrl = "https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:name=$dashboardName"
    Write-Host "  URL: $dashboardUrl" -ForegroundColor Blue
}

# Check CloudWatch alarms
Write-Host "`n=== CloudWatch Alarms Check ===" -ForegroundColor Cyan
$alarmPrefix = "$appName-"
$alarms = aws cloudwatch describe-alarms --alarm-name-prefix $alarmPrefix 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to get alarms" -ForegroundColor Red
} else {
    $alarmsJson = $alarms | ConvertFrom-Json
    $alarmCount = $alarmsJson.MetricAlarms.Count
    if ($alarmCount -gt 0) {
        Write-Host "OK: $alarmCount alarms configured" -ForegroundColor Green
        foreach ($alarm in $alarmsJson.MetricAlarms) {
            $state = $alarm.StateValue
            $stateColor = switch ($state) {
                "OK" { "Green" }
                "ALARM" { "Red" }
                "INSUFFICIENT_DATA" { "Yellow" }
                default { "White" }
            }
            Write-Host "  - $($alarm.AlarmName) : $state" -ForegroundColor $stateColor
        }
    } else {
        Write-Host "Warning: No alarms found" -ForegroundColor Yellow
    }
}

# Check Lambda X-Ray tracing
Write-Host "`n=== Lambda X-Ray Tracing Check ===" -ForegroundColor Cyan
$functions = aws lambda list-functions 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to get Lambda functions" -ForegroundColor Red
} else {
    $functionsJson = $functions | ConvertFrom-Json
    $appFunctions = $functionsJson.Functions | Where-Object { $_.FunctionName -like "$appName-*-$environment" }
    
    if ($appFunctions.Count -gt 0) {
        Write-Host "OK: Found $($appFunctions.Count) Lambda functions" -ForegroundColor Green
        foreach ($func in $appFunctions) {
            $config = aws lambda get-function-configuration --function-name $func.FunctionName 2>&1 | ConvertFrom-Json
            $tracingMode = $config.TracingConfig.Mode
            if ($tracingMode -eq "Active") {
                Write-Host "  OK: $($func.FunctionName) : X-Ray enabled" -ForegroundColor Green
            } else {
                Write-Host "  Warning: $($func.FunctionName) : X-Ray disabled" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "Warning: No Lambda functions found" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Useful Links ===" -ForegroundColor Cyan
Write-Host "CloudWatch Dashboards:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:" -ForegroundColor Blue
Write-Host "`nCloudWatch Alarms:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#alarmsV2:" -ForegroundColor Blue
Write-Host "`nX-Ray Traces:"
Write-Host "  https://console.aws.amazon.com/xray/home?region=$region#/traces" -ForegroundColor Blue
Write-Host "`nCloudWatch Logs:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#logsV2:log-groups" -ForegroundColor Blue

Write-Host "`nCheck complete!" -ForegroundColor Green
