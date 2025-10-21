# Verify tags on all resources

$ErrorActionPreference = "Stop"

Write-Host "=== Verifying Resource Tags ===" -ForegroundColor Cyan
Write-Host ""

$tagKey = "Application"
$tagValue = "meeting-minutes-generator"

# 1. Lambda Functions
Write-Host "1. Checking Lambda function tags..." -ForegroundColor Yellow
$lambdas = aws lambda list-functions --query "Functions[?contains(FunctionName, 'meeting-minutes')].FunctionName" --output json | ConvertFrom-Json

foreach ($lambda in $lambdas) {
    $tags = aws lambda list-tags --resource (aws lambda get-function --function-name $lambda --query 'Configuration.FunctionArn' --output text) --output json 2>$null | ConvertFrom-Json
    if ($tags.Tags.$tagKey -eq $tagValue) {
        Write-Host "  OK $lambda" -ForegroundColor Green
    } else {
        Write-Host "  X $lambda (no tag)" -ForegroundColor Red
    }
}

# 2. S3 Buckets
Write-Host "`n2. Checking S3 bucket tags..." -ForegroundColor Yellow
$buckets = aws s3api list-buckets --query "Buckets[?contains(Name, 'meeting-minutes')].Name" --output json | ConvertFrom-Json

foreach ($bucket in $buckets) {
    try {
        $tags = aws s3api get-bucket-tagging --bucket $bucket --output json 2>$null | ConvertFrom-Json
        $hasTag = $tags.TagSet | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
        if ($hasTag) {
            Write-Host "  OK $bucket" -ForegroundColor Green
        } else {
            Write-Host "  X $bucket (no tag)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  X $bucket (error getting tags)" -ForegroundColor Red
    }
}

# 3. DynamoDB Tables
Write-Host "`n3. Checking DynamoDB table tags..." -ForegroundColor Yellow
$tables = aws dynamodb list-tables --query "TableNames[?contains(@, 'MeetingJobs')]" --output json | ConvertFrom-Json

foreach ($table in $tables) {
    $arn = aws dynamodb describe-table --table-name $table --query 'Table.TableArn' --output text
    $tags = aws dynamodb list-tags-of-resource --resource-arn $arn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  OK $table" -ForegroundColor Green
    } else {
        Write-Host "  X $table (no tag)" -ForegroundColor Red
    }
}

# 4. API Gateway
Write-Host "`n4. Checking API Gateway tags..." -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --query "items[?contains(name, 'MeetingMinutes')].id" --output json | ConvertFrom-Json

foreach ($apiId in $apis) {
    $tags = aws apigateway get-tags --resource-arn "arn:aws:apigateway:ap-northeast-1::/restapis/$apiId" --output json 2>$null | ConvertFrom-Json
    if ($tags.tags.$tagKey -eq $tagValue) {
        Write-Host "  OK API: $apiId" -ForegroundColor Green
    } else {
        Write-Host "  X API: $apiId (no tag)" -ForegroundColor Red
    }
}

# 5. Step Functions
Write-Host "`n5. Checking Step Functions tags..." -ForegroundColor Yellow
$stateMachines = aws stepfunctions list-state-machines --query "stateMachines[?contains(name, 'meeting-minutes')].stateMachineArn" --output json | ConvertFrom-Json

foreach ($arn in $stateMachines) {
    $tags = aws stepfunctions list-tags-for-resource --resource-arn $arn --output json | ConvertFrom-Json
    $hasTag = $tags.tags | Where-Object { $_.key -eq $tagKey -and $_.value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  OK $($arn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  X $($arn.Split(':')[-1]) (no tag)" -ForegroundColor Red
    }
}

# 6. Cognito User Pool
Write-Host "`n6. Checking Cognito User Pool tags..." -ForegroundColor Yellow
$userPools = aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?contains(Name, 'meeting-minutes')].Id" --output json | ConvertFrom-Json

foreach ($poolId in $userPools) {
    $arn = aws cognito-idp describe-user-pool --user-pool-id $poolId --query 'UserPool.Arn' --output text
    $tags = aws cognito-idp list-tags-for-resource --resource-arn $arn --output json | ConvertFrom-Json
    if ($tags.Tags.$tagKey -eq $tagValue) {
        Write-Host "  OK $poolId" -ForegroundColor Green
    } else {
        Write-Host "  X $poolId (no tag)" -ForegroundColor Red
    }
}

# 7. CloudWatch Log Groups
Write-Host "`n7. Checking CloudWatch Log Groups tags..." -ForegroundColor Yellow
$logGroups = aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'meeting-minutes')].logGroupName" --output json | ConvertFrom-Json

foreach ($logGroup in $logGroups) {
    $tags = aws logs list-tags-log-group --log-group-name $logGroup --output json 2>$null | ConvertFrom-Json
    if ($tags.tags.$tagKey -eq $tagValue) {
        Write-Host "  OK $logGroup" -ForegroundColor Green
    } else {
        Write-Host "  X $logGroup (no tag)" -ForegroundColor Red
    }
}

# 8. IAM Roles
Write-Host "`n8. Checking IAM Roles tags..." -ForegroundColor Yellow
$roles = aws iam list-roles --query "Roles[?contains(RoleName, 'meeting-minutes')].RoleName" --output json | ConvertFrom-Json

foreach ($role in $roles) {
    $tags = aws iam list-role-tags --role-name $role --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  OK $role" -ForegroundColor Green
    } else {
        Write-Host "  X $role (no tag)" -ForegroundColor Red
    }
}

# 9. SNS Topics
Write-Host "`n9. Checking SNS Topics tags..." -ForegroundColor Yellow
$topics = aws sns list-topics --query "Topics[?contains(TopicArn, 'meeting-minutes')].TopicArn" --output json | ConvertFrom-Json

foreach ($topicArn in $topics) {
    $tags = aws sns list-tags-for-resource --resource-arn $topicArn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  OK $($topicArn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  X $($topicArn.Split(':')[-1]) (no tag)" -ForegroundColor Red
    }
}

# 10. CloudWatch Alarms
Write-Host "`n10. Checking CloudWatch Alarms tags..." -ForegroundColor Yellow
$alarms = aws cloudwatch describe-alarms --query "MetricAlarms[?contains(AlarmName, 'meeting-minutes')].AlarmArn" --output json | ConvertFrom-Json

foreach ($alarmArn in $alarms) {
    $tags = aws cloudwatch list-tags-for-resource --resource-arn $alarmArn --output json | ConvertFrom-Json
    $hasTag = $tags.Tags | Where-Object { $_.Key -eq $tagKey -and $_.Value -eq $tagValue }
    if ($hasTag) {
        Write-Host "  OK $($alarmArn.Split(':')[-1])" -ForegroundColor Green
    } else {
        Write-Host "  X $($alarmArn.Split(':')[-1]) (no tag)" -ForegroundColor Red
    }
}

# 11. Amplify App
Write-Host "`n11. Checking Amplify App tags..." -ForegroundColor Yellow
$amplifyApps = aws amplify list-apps --query "apps[?contains(name, 'meeting-minutes')].appId" --output json | ConvertFrom-Json

foreach ($appId in $amplifyApps) {
    $app = aws amplify get-app --app-id $appId --output json | ConvertFrom-Json
    if ($app.app.tags.$tagKey -eq $tagValue) {
        Write-Host "  OK Amplify App: $appId" -ForegroundColor Green
    } else {
        Write-Host "  X Amplify App: $appId (no tag)" -ForegroundColor Red
    }
}

Write-Host "`n=== Tag Limitations ===" -ForegroundColor Cyan
Write-Host "The following services do not support tagging:" -ForegroundColor Yellow
Write-Host "  - Amazon Transcribe (job-level tagging only)" -ForegroundColor Gray
Write-Host "  - Amazon Bedrock (no tagging for model invocations)" -ForegroundColor Gray
Write-Host "  - CloudWatch Dashboards (no tagging support)" -ForegroundColor Gray
Write-Host "  - API Gateway Deployment/Stage (REST API supports tagging)" -ForegroundColor Gray

Write-Host "`nCompleted" -ForegroundColor Cyan
