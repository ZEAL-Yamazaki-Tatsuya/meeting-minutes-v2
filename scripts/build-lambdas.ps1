# Lambda関数をビルドするスクリプト

Write-Host "Lambda関数をビルドしています..." -ForegroundColor Green

# TypeScriptをコンパイル
Write-Host "TypeScriptをコンパイルしています..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScriptのコンパイルに失敗しました" -ForegroundColor Red
    exit 1
}

# distディレクトリにLambda関数をコピー
Write-Host "Lambda関数をdistディレクトリにコピーしています..." -ForegroundColor Yellow

$lambdaFunctions = @(
    "upload-handler",
    "transcribe-trigger",
    "check-transcribe-status"
)

foreach ($func in $lambdaFunctions) {
    $srcPath = "dist/src/lambdas/$func"
    $destPath = "dist/lambdas/$func"
    
    if (Test-Path $srcPath) {
        # ディレクトリを作成
        New-Item -ItemType Directory -Force -Path $destPath | Out-Null
        
        # ファイルをコピー
        Copy-Item -Path "$srcPath/*" -Destination $destPath -Recurse -Force
        
        Write-Host "  ✓ $func をコピーしました" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $func が見つかりません: $srcPath" -ForegroundColor Red
    }
}

# 共通モジュールをコピー
Write-Host "共通モジュールをコピーしています..." -ForegroundColor Yellow

$commonModules = @(
    "models",
    "repositories",
    "utils"
)

foreach ($module in $commonModules) {
    $srcPath = "dist/src/$module"
    
    foreach ($func in $lambdaFunctions) {
        $destPath = "dist/lambdas/$func/$module"
        
        if (Test-Path $srcPath) {
            # ディレクトリを作成
            New-Item -ItemType Directory -Force -Path $destPath | Out-Null
            
            # ファイルをコピー
            Copy-Item -Path "$srcPath/*" -Destination $destPath -Recurse -Force
        }
    }
}

Write-Host "✓ Lambda関数のビルドが完了しました" -ForegroundColor Green
