# MFA認証スクリプト

MFA（多要素認証）を使用してAWSの一時的な認証情報を取得し、環境変数に設定するスクリプトです。

## 前提条件

- AWS CLIがインストールされていること
- AWS CLIプロファイルが設定されていること
- MFAデバイスが有効化されていること
- Bash版: `jq`コマンドがインストールされていること

## 使用方法

### PowerShell版（Windows）

```powershell
.\scripts\setup-mfa-credentials.ps1 -ProfileName "your-profile" -MfaSerialNumber "arn:aws:iam::123456789012:mfa/your-mfa-device" -TokenCode "123456"
```

### Bash版（Linux/Mac）

```bash
# 実行権限を付与
chmod +x scripts/setup-mfa-credentials.sh

# スクリプトを実行（環境変数を設定するにはsourceが必要）
source scripts/setup-mfa-credentials.sh your-profile arn:aws:iam::123456789012:mfa/your-mfa-device 123456
```

## パラメータ

- `ProfileName` / 第1引数: AWS CLIプロファイル名
- `MfaSerialNumber` / 第2引数: MFAデバイスのARN
- `TokenCode` / 第3引数: MFAデバイスから取得した6桁のコード

## MFAデバイスのARNを確認する方法

```bash
aws iam list-mfa-devices --profile your-profile
```

または、AWSコンソールで確認：
1. IAM → ユーザー → 自分のユーザー名
2. 「セキュリティ認証情報」タブ
3. 「MFAデバイスの割り当て」セクション

## 注意事項

- 取得した一時認証情報は**現在のシェルセッションでのみ有効**です
- デフォルトの有効期限は12時間です
- 新しいターミナルを開く場合は、再度スクリプトを実行する必要があります

## トラブルシューティング

### エラー: "An error occurred (AccessDenied)"

- プロファイル名が正しいか確認してください
- MFAデバイスのARNが正しいか確認してください
- トークンコードが有効期限内か確認してください（30秒ごとに更新されます）

### Bash版: "jq: command not found"

jqをインストールしてください：

```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Windows (Git Bash)
# Git Bashに含まれているか、Chocolateyでインストール
choco install jq
```
