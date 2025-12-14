# 既存議事録の summaryPreview をバッチ処理で追加する PowerShell スクリプト
#
# 使用方法:
# .\scripts\migrate-summary-preview.ps1
#
# オプション:
# -DryRun: 実際の更新は行わない（デフォルト: false）
#
# 例:
# .\scripts\migrate-summary-preview.ps1 -DryRun

param(
    [switch]$DryRun = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "既存議事録の summaryPreview マイグレーション" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# .env ファイルから環境変数を読み込む
if (Test-Path ".env") {
    Write-Host "環境変数を .env ファイルから読み込んでいます..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "警告: .env ファイルが見つかりません" -ForegroundColor Yellow
}

# 環境変数の確認
$JOBS_TABLE_NAME = $env:JOBS_TABLE_NAME
$OUTPUT_BUCKET_NAME = $env:OUTPUT_BUCKET_NAME
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }

if (-not $JOBS_TABLE_NAME) {
    Write-Host "エラー: JOBS_TABLE_NAME 環境変数が設定されていません" -ForegroundColor Red
    exit 1
}

if (-not $OUTPUT_BUCKET_NAME) {
    Write-Host "エラー: OUTPUT_BUCKET_NAME 環境変数が設定されていません" -ForegroundColor Red
    exit 1
}

Write-Host "テーブル名: $JOBS_TABLE_NAME" -ForegroundColor Green
Write-Host "バケット名: $OUTPUT_BUCKET_NAME" -ForegroundColor Green
Write-Host "リージョン: $AWS_REGION" -ForegroundColor Green
if ($DryRun) {
    Write-Host "DRY RUN: はい（実際の更新は行いません）" -ForegroundColor Yellow
    $env:DRY_RUN = "true"
} else {
    Write-Host "DRY RUN: いいえ" -ForegroundColor Green
    $env:DRY_RUN = "false"
}
Write-Host ""

# TypeScript スクリプトを実行
Write-Host "マイグレーションスクリプトを実行しています..." -ForegroundColor Cyan
Write-Host ""

try {
    npx ts-node scripts/migrate-summary-preview.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ マイグレーションが正常に完了しました" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ マイグレーションが失敗しました (終了コード: $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "✗ マイグレーションの実行中にエラーが発生しました: $_" -ForegroundColor Red
    exit 1
}
