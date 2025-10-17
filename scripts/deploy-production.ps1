# Production環境へのデプロイスクリプト

Write-Host "🚀 Production環境へのデプロイを開始します..." -ForegroundColor Cyan

# エラーが発生したら停止
$ErrorActionPreference = "Stop"

# スクリプトのディレクトリを取得
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# ルートディレクトリに移動
Set-Location $rootDir

try {
    # 確認プロンプト
    Write-Host "`n⚠️  Production環境へのデプロイを実行しようとしています。" -ForegroundColor Yellow
    $confirmation = Read-Host "続行しますか？ (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "デプロイをキャンセルしました。" -ForegroundColor Yellow
        exit 0
    }

    # 1. 環境変数を読み込む
    Write-Host "`n📋 環境変数を読み込んでいます..." -ForegroundColor Yellow
    if (Test-Path ".env.production") {
        Get-Content ".env.production" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
                Write-Host "  ✓ $name" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  ⚠️  .env.productionファイルが見つかりません" -ForegroundColor Yellow
    }

    # 2. 依存関係をインストール
    Write-Host "`n📦 依存関係をインストールしています..." -ForegroundColor Yellow
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "依存関係のインストールに失敗しました" }

    # 3. テストを実行
    Write-Host "`n🧪 テストを実行しています..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) { throw "テストに失敗しました" }

    # 4. Lambda関数をビルド
    Write-Host "`n🔨 Lambda関数をビルドしています..." -ForegroundColor Yellow
    npm run build:lambdas
    if ($LASTEXITCODE -ne 0) { throw "Lambda関数のビルドに失敗しました" }

    # 5. CDKスタックをデプロイ
    Write-Host "`n☁️  CDKスタックをデプロイしています..." -ForegroundColor Yellow
    
    Write-Host "  → Storage Stack" -ForegroundColor Cyan
    npx cdk deploy meeting-minutes-generator-storage-prod --require-approval never --context environment=prod
    if ($LASTEXITCODE -ne 0) { throw "Storage Stackのデプロイに失敗しました" }
    
    Write-Host "  → Auth Stack" -ForegroundColor Cyan
    npx cdk deploy meeting-minutes-generator-auth-prod --require-approval never --context environment=prod
    if ($LASTEXITCODE -ne 0) { throw "Auth Stackのデプロイに失敗しました" }
    
    Write-Host "  → Compute Stack" -ForegroundColor Cyan
    npx cdk deploy meeting-minutes-generator-compute-prod --require-approval never --context environment=prod
    if ($LASTEXITCODE -ne 0) { throw "Compute Stackのデプロイに失敗しました" }

    # 6. API URLを取得
    Write-Host "`n🔍 API URLを取得しています..." -ForegroundColor Yellow
    $apiUrl = aws cloudformation describe-stacks `
        --stack-name meeting-minutes-generator-compute-prod `
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
        --output text `
        --region ap-northeast-1
    
    if ($apiUrl) {
        Write-Host "  ✓ API URL: $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  API URLの取得に失敗しました" -ForegroundColor Yellow
    }

    # 7. Cognito情報を取得
    Write-Host "`n🔐 Cognito情報を取得しています..." -ForegroundColor Yellow
    $userPoolId = aws cloudformation describe-stacks `
        --stack-name meeting-minutes-generator-auth-prod `
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
        --output text `
        --region ap-northeast-1
    
    $clientId = aws cloudformation describe-stacks `
        --stack-name meeting-minutes-generator-auth-prod `
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" `
        --output text `
        --region ap-northeast-1
    
    if ($userPoolId -and $clientId) {
        Write-Host "  ✓ User Pool ID: $userPoolId" -ForegroundColor Green
        Write-Host "  ✓ Client ID: $clientId" -ForegroundColor Green
    }

    # 8. フロントエンドの環境変数を作成
    Write-Host "`n📝 フロントエンドの環境変数を作成しています..." -ForegroundColor Yellow
    $frontendEnv = @"
NEXT_PUBLIC_API_URL=$apiUrl
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$userPoolId
NEXT_PUBLIC_COGNITO_CLIENT_ID=$clientId
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
"@
    $frontendEnv | Out-File -FilePath "frontend/.env.local" -Encoding utf8
    Write-Host "  ✓ frontend/.env.local を作成しました" -ForegroundColor Green

    # 9. フロントエンドをビルド
    Write-Host "`n🏗️  フロントエンドをビルドしています..." -ForegroundColor Yellow
    Set-Location frontend
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "フロントエンドの依存関係のインストールに失敗しました" }
    
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "フロントエンドのビルドに失敗しました" }
    Set-Location ..

    # 10. Amplifyスタックをデプロイ
    Write-Host "`n🌐 Amplifyスタックをデプロイしています..." -ForegroundColor Yellow
    npx cdk deploy meeting-minutes-generator-amplify-prod --require-approval never --context environment=prod
    if ($LASTEXITCODE -ne 0) { throw "Amplify Stackのデプロイに失敗しました" }

    # 11. Amplify URLを取得
    Write-Host "`n🔍 Amplify URLを取得しています..." -ForegroundColor Yellow
    $amplifyUrl = aws cloudformation describe-stacks `
        --stack-name meeting-minutes-generator-amplify-prod `
        --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppUrl'].OutputValue" `
        --output text `
        --region ap-northeast-1
    
    if ($amplifyUrl) {
        Write-Host "  ✓ Amplify URL: $amplifyUrl" -ForegroundColor Green
    }

    # 12. デプロイ完了
    Write-Host "`n✅ Production環境へのデプロイが完了しました！" -ForegroundColor Green
    Write-Host "`n📊 デプロイ情報:" -ForegroundColor Cyan
    Write-Host "  環境: Production" -ForegroundColor White
    Write-Host "  API URL: $apiUrl" -ForegroundColor White
    Write-Host "  Frontend URL: $amplifyUrl" -ForegroundColor White
    Write-Host "  User Pool ID: $userPoolId" -ForegroundColor White
    Write-Host "  Client ID: $clientId" -ForegroundColor White

    Write-Host "`n🎉 本番環境が正常にデプロイされました！" -ForegroundColor Green

} catch {
    Write-Host "`n❌ デプロイ中にエラーが発生しました: $_" -ForegroundColor Red
    exit 1
}
