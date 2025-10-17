# モニタリングスタックのデプロイスクリプト

Write-Host "=== モニタリングスタックのデプロイ ===" -ForegroundColor Cyan

# .envファイルから環境変数を読み込む
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "✓ 環境変数を読み込みました" -ForegroundColor Green
} else {
    Write-Host "✗ .envファイルが見つかりません" -ForegroundColor Red
    exit 1
}

# 必要な環境変数の確認
$requiredVars = @(
    "AWS_ACCOUNT_ID",
    "AWS_REGION",
    "ENVIRONMENT",
    "APP_NAME"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var, "Process")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "✗ 以下の環境変数が設定されていません: $($missingVars -join ', ')" -ForegroundColor Red
    exit 1
}

$environment = [Environment]::GetEnvironmentVariable("ENVIRONMENT", "Process")
$appName = [Environment]::GetEnvironmentVariable("APP_NAME", "Process")
$stackName = "$appName-monitoring-$environment"

Write-Host "`n現在の設定:" -ForegroundColor Yellow
Write-Host "  環境: $environment"
Write-Host "  アプリ名: $appName"
Write-Host "  スタック名: $stackName"
Write-Host "  リージョン: $([Environment]::GetEnvironmentVariable('AWS_REGION', 'Process'))"

# アラート通知先メールアドレスの確認
$alertEmail = [Environment]::GetEnvironmentVariable("ALERT_EMAIL", "Process")
if ($alertEmail) {
    Write-Host "  アラート通知先: $alertEmail" -ForegroundColor Green
} else {
    Write-Host "  アラート通知先: 未設定（.envにALERT_EMAILを追加してください）" -ForegroundColor Yellow
}

Write-Host "`n続行しますか? (Y/N): " -NoNewline -ForegroundColor Yellow
$confirmation = Read-Host

if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "デプロイをキャンセルしました" -ForegroundColor Yellow
    exit 0
}

# CDKのブートストラップ確認
Write-Host "`n=== CDKブートストラップの確認 ===" -ForegroundColor Cyan
$bootstrapCheck = aws cloudformation describe-stacks --stack-name CDKToolkit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "CDKがブートストラップされていません。ブートストラップを実行します..." -ForegroundColor Yellow
    cdk bootstrap
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ CDKブートストラップに失敗しました" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ CDKブートストラップ済み" -ForegroundColor Green

# TypeScriptのビルド
Write-Host "`n=== TypeScriptのビルド ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ビルドに失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "✓ ビルド完了" -ForegroundColor Green

# CDK Synth
Write-Host "`n=== CDK Synth ===" -ForegroundColor Cyan
cdk synth $stackName
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ CDK Synthに失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "✓ CDK Synth完了" -ForegroundColor Green

# モニタリングスタックのデプロイ
Write-Host "`n=== モニタリングスタックのデプロイ ===" -ForegroundColor Cyan
cdk deploy $stackName --require-approval never
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ デプロイに失敗しました" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ モニタリングスタックのデプロイが完了しました！" -ForegroundColor Green

# デプロイ後の情報表示
Write-Host "`n=== デプロイ情報 ===" -ForegroundColor Cyan

# CloudFormationスタックの出力を取得
$outputs = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" --output json 2>$null | ConvertFrom-Json

if ($outputs) {
    Write-Host "`nスタック出力:" -ForegroundColor Yellow
    foreach ($output in $outputs) {
        Write-Host "  $($output.OutputKey): $($output.OutputValue)"
    }
}

# ダッシュボードURLの表示
$region = [Environment]::GetEnvironmentVariable("AWS_REGION", "Process")
$dashboardName = "$appName-$environment"
$dashboardUrl = "https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:name=$dashboardName"

Write-Host "`n=== 次のステップ ===" -ForegroundColor Cyan
Write-Host "1. CloudWatchダッシュボードにアクセス:"
Write-Host "   $dashboardUrl" -ForegroundColor Blue

if ($alertEmail) {
    Write-Host "`n2. アラート通知の確認:"
    Write-Host "   - $alertEmail にSNSサブスクリプション確認メールが送信されます"
    Write-Host "   - メール内のリンクをクリックして確認を完了してください"
}

Write-Host "`n3. X-Rayトレースの確認:"
Write-Host "   https://console.aws.amazon.com/xray/home?region=$region#/traces" -ForegroundColor Blue

Write-Host "`n✓ すべての処理が完了しました！" -ForegroundColor Green
