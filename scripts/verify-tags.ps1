# すべてのリソースのタグを確認するスクリプト

$ErrorActionPreference = "Stop"

Write-Host "=== リソースタグの確認 ===" -ForegroundColor Cyan
Write-Host ""

$tagKey = "Application"
$tagValue = "meeting-minutes-generator"

# 1. Lambda関数
Write-Host "1. Lambda関数のタグを確認中..." -ForegroundColor Yellow
$lambdas = aws lambda list-functions --query "Functions[?contains(FunctionName, 'meeting-minutes')].FunctionName" --output json | ConvertFrom-Json

foreach ($lambda in $lambdas) {
    $tags = aws lambda list-tags --resource (aws lambda get-function --function-name $lambda --query 'Configuration.FunctionArn' --output text) --output json 2>$null | ConvertFrom-Json
    if ($tags.Tags.$tagKey -eq $tagValue) {
        Write-Host "  ✓ $lambda" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $lambda (タグなし)" -ForegroundColor Red
    }
}

# 2. S3バケット
Write-Host "`n2. S3バケットのタグを確認中..." -ForegroundColor Yellow
$buckets = aws s3api list-buckets --query "Buckets[?contains(Name, 'meeting-minutes')].Name" --output json | ConvertFrom-Json

foreach ($bucket in $buckets) {
    try {
        $tags = aws s3api get-bucket-tagging --bucket $bucket --output json 2>$null | ConvertFrom-Json
        $hasTag = $tags.TagSet | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
        if ($hasTag) {
            Write-Host "  ✓ $bucket" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $bucket (タグなし)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ✗ $bucket (タグ取得エラー)" -ForegroundColor Red
    }
}

# 3. DynamoDBテーブル
Write-Host "`n3. DynamoDBテーブルのタグを確認中..." -ForegroundColor Yellow
$tables = aws dynamodb list-tables --query "TableNames[?contains(@, 'MeetingJobs')]" --output json | ConvertFrom-Json

foreach ($table in $tables) {
    $arn = aws dynamodb describe-table --table-name $table --query 'Table.TableArn' --output text
    $tags = aws dynamodb list-tags-of-resource --resource-arn $arn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  ✓ $table" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $table (タグなし)" -ForegroundColor Red
    }
}

# 4. API Gateway
Write-Host "`n4. API Gatewayのタグを確認中..." -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --query "items[?contains(name, 'MeetingMinutes')].id" --output json | ConvertFrom-Json

foreach ($apiId in $apis) {
    $tags = aws apigateway get-tags --resource-arn "arn:aws:apigateway:ap-northeast-1::/restapis/$apiId" --output json 2>$null | ConvertFrom-Json
    if ($tags.tags.$tagKey -eq $tagValue) {
        Write-Host "  ✓ API: $apiId" -ForegroundColor Green
    } else {
        Write-Host "  ✗ API: $apiId (タグなし)" -ForegroundColor Red
    }
}

# 5. Step Functions
Write-Host "`n5. Step Functionsのタグを確認中..." -ForegroundColor Yellow
$stateMachines = aws stepfunctions list-state-machines --query "stateMachines[?contains(name, 'meeting-minutes')].stateMachineArn" --output json | ConvertFrom-Json

foreach ($arn in $stateMachines) {
    $tags = aws stepfunctions list-tags-for-resource --resource-arn $arn --output json | ConvertFrom-Json
    $hasTag = $tags.tags | Where-Object { $_.key -eq $tagKey -and $_.value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  ✓ $($arn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($arn.Split(':')[-1]) (タグなし)" -ForegroundColor Red
    }
}

# 6. Cognito User Pool
Write-Host "`n6. Cognito User Poolのタグを確認中..." -ForegroundColor Yellow
$userPools = aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?contains(Name, 'meeting-minutes')].Id" --output json | ConvertFrom-Json

foreach ($poolId in $userPools) {
    $arn = aws cognito-idp describe-user-pool --user-pool-id $poolId --query 'UserPool.Arn' --output text
    $tags = aws cognito-idp list-tags-for-resource --resource-arn $arn --output json | ConvertFrom-Json
    if ($tags.Tags.$tagKey -eq $tagValue) {
        Write-Host "  ✓ $poolId" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $poolId (タグなし)" -ForegroundColor Red
    }
}

# 7. CloudWatch Log Groups
Write-Host "`n7. CloudWatch Log Groupsのタグを確認中..." -ForegroundColor Yellow
$logGroups = aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'meeting-minutes')].logGroupName" --output json | ConvertFrom-Json

foreach ($logGroup in $logGroups) {
    $tags = aws logs list-tags-log-group --log-group-name $logGroup --output json 2>$null | ConvertFrom-Json
    if ($tags.tags.$tagKey -eq $tagValue) {
        Write-Host "  ✓ $logGroup" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $logGroup (タグなし)" -ForegroundColor Red
    }
}

# 8. IAM Roles
Write-Host "`n8. IAM Rolesのタグを確認中..." -ForegroundColor Yellow
$roles = aws iam list-roles --query "Roles[?contains(RoleName, 'meeting-minutes')].RoleName" --output json | ConvertFrom-Json

foreach ($role in $roles) {
    $tags = aws iam list-role-tags --role-name $role --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  ✓ $role" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $role (タグなし)" -ForegroundColor Red
    }
}

# 9. SNS Topics
Write-Host "`n9. SNS Topicsのタグを確認中..." -ForegroundColor Yellow
$topics = aws sns list-topics --query "Topics[?contains(TopicArn, 'meeting-minutes')].TopicArn" --output json | ConvertFrom-Json

foreach ($topicArn in $topics) {
    $tags = aws sns list-tags-for-resource --resource-arn $topicArn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  ✓ $($topicArn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($topicArn.Split(':')[-1]) (タグなし)" -ForegroundColor Red
    }
}

# 10. CloudWatch Alarms
Write-Host "`n10. CloudWatch Alarmsのタグを確認中..." -ForegroundColor Yellow
$alarms = aws cloudwatch describe-alarms --query "MetricAlarms[?contains(AlarmName, 'meeting-minutes')].AlarmArn" --output json | ConvertFrom-Json

foreach ($alarmArn in $alarms) {
    $tags = aws cloudwatch list-tags-for-resource --resource-arn $alarmArn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  ✓ $($alarmArn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($alarmArn.Split(':')[-1]) (タグなし)" -ForegroundColor Red
    }
}

# 11. Amplify App
Write-Host "`n11. Amplify Appのタグを確認中..." -ForegroundColor Yellow
$amplifyApps = aws amplify list-apps --query "apps[?contains(name, 'meeting-minutes')].appId" --output json | ConvertFrom-Json

foreach ($appId in $amplifyApps) {
    $app = aws amplify get-app --app-id $appId --output json | ConvertFrom-Json
    if ($app.app.tags.$tagKey -eq $tagValue) {
        Write-Host "  ✓ Amplify App: $appId" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Amplify App: $appId (タグなし)" -ForegroundColor Red
    }
}

Write-Host "`n=== タグ付けできないサービス ===" -ForegroundColor Cyan
Write-Host "以下のサービスはタグ付けをサポートしていません：" -ForegroundColor Yellow
Write-Host "  - Amazon Transcribe (ジョブ単位ではタグ可能)" -ForegroundColor Gray
Write-Host "  - Amazon Bedrock (モデル呼び出しにはタグなし)" -ForegroundColor Gray
Write-Host "  - CloudWatch Dashboards (タグ非対応)" -ForegroundColor Gray
Write-Host "  - API Gateway Deployment/Stage (REST APIにはタグ可能)" -ForegroundColor Gray

Write-Host "`n完了" -ForegroundColor Cyan
