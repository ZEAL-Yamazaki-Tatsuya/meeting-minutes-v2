# モニタリングスタックの状態確認スクリプト

Write-Host "=== モニタリングスタックの状態確認 ===" -ForegroundColor Cyan

# .envファイルから環境変数を読み込む
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "✗ .envファイルが見つかりません" -ForegroundColor Red
    exit 1
}

$environment = [Environment]::GetEnvironmentVariable("ENVIRONMENT", "Process")
$appName = [Environment]::GetEnvironmentVariable("APP_NAME", "Process")
$region = [Environment]::GetEnvironmentVariable("AWS_REGION", "Process")
$stackName = "$appName-monitoring-$environment"

Write-Host "`n環境設定:" -ForegroundColor Yellow
Write-Host "  環境: $environment"
Write-Host "  アプリ名: $appName"
Write-Host "  スタック名: $stackName"
Write-Host "  リージョン: $region"

# AWS認証情報の確認
Write-Host "`n=== AWS認証情報の確認 ===" -ForegroundColor Cyan
$identity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ AWS認証情報が無効です" -ForegroundColor Red
    Write-Host "  以下のコマンドでAWS認証情報を設定してください:" -ForegroundColor Yellow
    Write-Host "  aws configure" -ForegroundColor Yellow
    exit 1
}
$identityJson = $identity | ConvertFrom-Json
Write-Host "✓ AWS認証情報が有効です" -ForegroundColor Green
Write-Host "  アカウントID: $($identityJson.Account)"
Write-Host "  ユーザー: $($identityJson.Arn)"

# CloudFormationスタックの確認
Write-Host "`n=== CloudFormationスタックの確認 ===" -ForegroundColor Cyan
$stackInfo = aws cloudformation describe-stacks --stack-name $stackName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ モニタリングスタックがデプロイされていません" -ForegroundColor Red
    Write-Host "`nモニタリングスタックをデプロイするには、以下のコマンドを実行してください:" -ForegroundColor Yellow
    Write-Host "  .\scripts\deploy-monitoring.ps1" -ForegroundColor Yellow
    exit 1
}

$stack = $stackInfo | ConvertFrom-Json
$stackStatus = $stack.Stacks[0].StackStatus
$creationTime = $stack.Stacks[0].CreationTime

Write-Host "✓ モニタリングスタックがデプロイされています" -ForegroundColor Green
Write-Host "  ステータス: $stackStatus"
Write-Host "  作成日時: $creationTime"

# スタック出力の表示
Write-Host "`n=== スタック出力 ===" -ForegroundColor Cyan
$outputs = $stack.Stacks[0].Outputs
if ($outputs) {
    foreach ($output in $outputs) {
        Write-Host "  $($output.OutputKey): $($output.OutputValue)"
    }
} else {
    Write-Host "  出力なし"
}

# CloudWatchダッシュボードの確認
Write-Host "`n=== CloudWatchダッシュボードの確認 ===" -ForegroundColor Cyan
$dashboardName = "$appName-$environment"
$dashboardInfo = aws cloudwatch get-dashboard --dashboard-name $dashboardName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ダッシュボードが見つかりません: $dashboardName" -ForegroundColor Red
} else {
    Write-Host "✓ ダッシュボードが存在します: $dashboardName" -ForegroundColor Green
    $dashboardUrl = "https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:name=$dashboardName"
    Write-Host "  URL: $dashboardUrl" -ForegroundColor Blue
}

# CloudWatchアラームの確認
Write-Host "`n=== CloudWatchアラームの確認 ===" -ForegroundColor Cyan
$alarms = aws cloudwatch describe-alarms --alarm-name-prefix "$appName-" --query "MetricAlarms[?contains(AlarmName, '$environment')].[AlarmName,StateValue]" --output text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ アラームの取得に失敗しました" -ForegroundColor Red
} else {
    $alarmLines = $alarms -split "`n" | Where-Object { $_ -ne "" }
    if ($alarmLines.Count -gt 0) {
        Write-Host "✓ アラームが設定されています（$($alarmLines.Count)個）" -ForegroundColor Green
        foreach ($line in $alarmLines) {
            $parts = $line -split "`t"
            if ($parts.Count -ge 2) {
                $alarmName = $parts[0]
                $state = $parts[1]
                $stateColor = switch ($state) {
                    "OK" { "Green" }
                    "ALARM" { "Red" }
                    "INSUFFICIENT_DATA" { "Yellow" }
                    default { "White" }
                }
                Write-Host "  - $alarmName : $state" -ForegroundColor $stateColor
            }
        }
    } else {
        Write-Host "  アラームが見つかりません"
    }
}

# SNSトピックの確認
Write-Host "`n=== SNSトピックの確認 ===" -ForegroundColor Cyan
$topicFilter = "$appName-alarms-$environment"
$topics = aws sns list-topics --query "Topics[?contains(TopicArn, ``$topicFilter``)].TopicArn" --output text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ SNSトピックの取得に失敗しました" -ForegroundColor Red
} else {
    if ($topics) {
        Write-Host "✓ SNSトピックが存在します" -ForegroundColor Green
        Write-Host "  ARN: $topics"
        
        # サブスクリプションの確認
        $subscriptions = aws sns list-subscriptions-by-topic --topic-arn $topics --query "Subscriptions[*].[Protocol,Endpoint,SubscriptionArn]" --output text 2>&1
        if ($subscriptions) {
            Write-Host "`n  サブスクリプション:"
            $subLines = $subscriptions -split "`n" | Where-Object { $_ -ne "" }
            foreach ($line in $subLines) {
                $parts = $line -split "`t"
                if ($parts.Count -ge 3) {
                    $protocol = $parts[0]
                    $endpoint = $parts[1]
                    $subArn = $parts[2]
                    $status = if ($subArn -like "*PendingConfirmation*") { "保留中" } else { "確認済み" }
                    Write-Host "    - $protocol : $endpoint ($status)"
                }
            }
        } else {
            Write-Host "  サブスクリプションなし"
        }
    } else {
        Write-Host "  SNSトピックが見つかりません"
    }
}

# Lambda関数のX-Rayトレーシング確認
Write-Host "`n=== Lambda関数のX-Rayトレーシング確認 ===" -ForegroundColor Cyan
$functions = aws lambda list-functions --query "Functions[?contains(FunctionName, ``$appName-``)].FunctionName" --output text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lambda関数の取得に失敗しました" -ForegroundColor Red
} else {
    $functionList = $functions -split "`s+" | Where-Object { $_ -ne "" }
    if ($functionList.Count -gt 0) {
        Write-Host "✓ Lambda関数が見つかりました（$($functionList.Count)個）" -ForegroundColor Green
        foreach ($func in $functionList) {
            $config = aws lambda get-function-configuration --function-name $func --query "TracingConfig.Mode" --output text 2>&1
            if ($config -eq "Active") {
                Write-Host "  ✓ $func : X-Ray有効" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $func : X-Ray無効" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  Lambda関数が見つかりません"
    }
}

Write-Host "`n=== 便利なリンク ===" -ForegroundColor Cyan
Write-Host "CloudWatchダッシュボード:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:" -ForegroundColor Blue
Write-Host "`nCloudWatchアラーム:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#alarmsV2:" -ForegroundColor Blue
Write-Host "`nX-Rayトレース:"
Write-Host "  https://console.aws.amazon.com/xray/home?region=$region#/traces" -ForegroundColor Blue
Write-Host "`nCloudWatch Logs:"
Write-Host "  https://console.aws.amazon.com/cloudwatch/home?region=$region#logsV2:log-groups" -ForegroundColor Blue

Write-Host "`n✓ 確認完了" -ForegroundColor Green
