# MFA認証を使用してAWS一時認証情報を取得し、環境変数に設定するスクリプト

param(
    [Parameter(Mandatory=$true)]
    [string]$ProfileName,
    
    [Parameter(Mandatory=$true)]
    [string]$MfaSerialNumber,
    
    [Parameter(Mandatory=$true)]
    [string]$TokenCode
)

Write-Host "MFA認証情報を取得中..." -ForegroundColor Cyan

try {
    # AWS STSコマンドを実行して一時認証情報を取得
    $output = aws sts get-session-token `
        --profile $ProfileName `
        --serial-number $MfaSerialNumber `
        --token-code $TokenCode `
        --output json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "エラー: AWS STSコマンドが失敗しました" -ForegroundColor Red
        exit 1
    }
    
    # JSONをパース
    $credentials = $output | ConvertFrom-Json
    
    # 環境変数に設定
    $env:AWS_ACCESS_KEY_ID = $credentials.Credentials.AccessKeyId
    $env:AWS_SECRET_ACCESS_KEY = $credentials.Credentials.SecretAccessKey
    $env:AWS_SESSION_TOKEN = $credentials.Credentials.SessionToken
    
    Write-Host "`n✓ 認証情報を環境変数に設定しました" -ForegroundColor Green
    Write-Host "`n有効期限: $($credentials.Credentials.Expiration)" -ForegroundColor Yellow
    
    Write-Host "`n以下のコマンドで環境変数を確認できます:" -ForegroundColor Cyan
    Write-Host "  echo `$env:AWS_ACCESS_KEY_ID"
    
    Write-Host "`n注意: これらの環境変数は現在のPowerShellセッションでのみ有効です" -ForegroundColor Yellow
    
} catch {
    Write-Host "エラー: $_" -ForegroundColor Red
    exit 1
}
