# LLMの出力ログを確認するスクリプト

$ErrorActionPreference = "Stop"

Write-Host "=== LLM出力ログの確認 ===" -ForegroundColor Cyan

# ログストリームを取得
$logGroupName = "/aws/lambda/MeetingMinutesApp-MinutesGeneratorFunction"

Write-Host "`nログストリームを取得中..." -ForegroundColor Yellow
$streams = aws logs describe-log-streams `
    --log-group-name $logGroupName `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --query 'logStreams[*].logStreamName' `
    --output json | ConvertFrom-Json

if ($streams.Count -eq 0) {
    Write-Host "ログストリームが見つかりません" -ForegroundColor Red
    exit 1
}

Write-Host "最新のログストリーム: $($streams[0])" -ForegroundColor Green

# ログイベントを取得（LLMレスポンスを含む）
Write-Host "`nLLMレスポンスを検索中..." -ForegroundColor Yellow
$events = aws logs filter-log-events `
    --log-group-name $logGroupName `
    --log-stream-names $streams[0] `
    --filter-pattern "LLMからのレスポンス" `
    --query 'events[*].message' `
    --output json | ConvertFrom-Json

if ($events.Count -eq 0) {
    Write-Host "LLMレスポンスが見つかりません" -ForegroundColor Red
    Write-Host "すべてのログを表示します..." -ForegroundColor Yellow
    
    aws logs get-log-events `
        --log-group-name $logGroupName `
        --log-stream-name $streams[0] `
        --limit 50 `
        --query 'events[*].message' `
        --output text
} else {
    Write-Host "`nLLMレスポンス:" -ForegroundColor Green
    $events | ForEach-Object { Write-Host $_ }
}

Write-Host "`n完了" -ForegroundColor Cyan
