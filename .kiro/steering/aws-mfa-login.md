---
inclusion: auto
---

# AWS MFA認証ログイン手順

## 概要

このプロジェクトではAWS CLIの操作にMFA認証が必要です。
`scripts/setup-mfa-credentials.ps1`を使用して一時認証情報を取得してください。

## 認証情報

- **AWSアカウントID**: 490030480543
- **プロファイル名**: `4900`
- **MFAシリアル番号**: `arn:aws:iam::490030480543:mfa/yamazaki_chrome`
- **IAMユーザー名**: Tatsuya_Yamazaki
- **リージョン**: ap-northeast-1

## 手順

### 1. MFAトークンコードの取得

ユーザーにMFA認証アプリの6桁コードを聞いてください。

### 2. 認証スクリプトの実行

```powershell
. .\scripts\setup-mfa-credentials.ps1 -ProfileName "4900" -MfaSerialNumber "arn:aws:iam::490030480543:mfa/yamazaki_chrome" -TokenCode "<ユーザーから取得した6桁コード>"
```

### 3. 認証確認

```powershell
aws sts get-caller-identity
```

## 注意事項

- 一時認証情報は現在のPowerShellセッションでのみ有効です
- 有効期限は通常12時間です
- `InvalidClientTokenId`エラーが出た場合は、トークンが期限切れなので再認証が必要です
- 認証が必要な操作：Amplifyビルドログ確認、CDKデプロイ、S3操作、DynamoDB操作など

## Amplifyアプリ情報

- **アプリID**: d1iv2q5yh6oc7s
- **アプリ名**: meeting-minutes-generator-dev
- **ドメイン**: d1iv2q5yh6oc7s.amplifyapp.com
- **ブランチ**: main
- **ビルドスペック**: `frontend/` ディレクトリでnpm ci → npm run build

## よく使うAWSコマンド

### Amplifyビルドログ確認

```powershell
# ジョブ一覧を取得
aws amplify list-jobs --app-id d1iv2q5yh6oc7s --branch-name main --region ap-northeast-1 --max-items 5

# 特定ジョブの詳細を取得
aws amplify get-job --app-id d1iv2q5yh6oc7s --branch-name main --job-id <ジョブID> --region ap-northeast-1

# ビルドログをダウンロード（logUrlから取得）
Invoke-WebRequest -Uri "<logUrl>" -OutFile "build_log.txt"
Get-Content "build_log.txt"
```

### CDK操作

```powershell
npx cdk diff
npx cdk deploy --all
```
