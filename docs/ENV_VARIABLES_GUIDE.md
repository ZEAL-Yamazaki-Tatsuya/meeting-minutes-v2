# 環境変数の取得ガイド

このガイドでは、フロントエンドのデプロイに必要な環境変数の取得方法を説明します。

## 📋 必要な環境変数

フロントエンドをCloudFrontにデプロイするには、以下の環境変数が必要です：

| 環境変数 | 説明 | 取得元 |
|---------|------|--------|
| `NEXT_PUBLIC_API_URL` | API GatewayのURL | ComputeStack |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID | AuthStack |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito Client ID | AuthStack |
| `NEXT_PUBLIC_AWS_REGION` | AWSリージョン | 設定値 |

## 🚀 自動取得（推奨）

### Windows

```powershell
# スクリプトを実行
.\scripts\get-env-values.ps1

# または
npm run get-env
```

### Linux/Mac

```bash
# 実行権限を付与
chmod +x scripts/get-env-values.sh

# スクリプトを実行
./scripts/get-env-values.sh
```

### スクリプトの動作

1. **バックエンドスタックから値を取得**
   - ComputeStackからAPI URLを取得
   - AuthStackからCognito情報を取得

2. **取得した値を表示**
   ```
   ✅ NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
   ✅ NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
   ✅ NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
   ```

3. **`.env`ファイルへの追加を確認**
   - `y`を入力すると自動的に`.env`ファイルに追加
   - `N`を入力すると手動でコピー

## 🔧 手動取得

### 1. API URL

```bash
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text \
  --region us-east-1
```

**出力例**: `https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev`

### 2. Cognito User Pool ID

```bash
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-auth-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text \
  --region us-east-1
```

**出力例**: `us-east-1_AbCdEfGhI`

### 3. Cognito Client ID

```bash
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-auth-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text \
  --region us-east-1
```

**出力例**: `1a2b3c4d5e6f7g8h9i0j`

## 📝 .envファイルへの追加

取得した値を`.env`ファイルに追加します：

```bash
# Frontend Configuration
NEXT_PUBLIC_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
NEXT_PUBLIC_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## 🔍 値の確認

### CloudFormationコンソールで確認

1. [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation/)にアクセス
2. スタックを選択（例: `meeting-minutes-generator-compute-dev`）
3. 「出力」タブをクリック
4. 必要な値をコピー

### AWS CLIで全ての出力を確認

```bash
# ComputeStackの出力
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-dev \
  --query "Stacks[0].Outputs" \
  --region us-east-1

# AuthStackの出力
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-auth-dev \
  --query "Stacks[0].Outputs" \
  --region us-east-1
```

## ❓ トラブルシューティング

### エラー: スタックが見つからない

**原因**: バックエンドスタックがまだデプロイされていません。

**解決策**:
```bash
# バックエンドをデプロイ
npm run deploy
```

### エラー: 出力が空

**原因**: スタックはデプロイされているが、出力が定義されていない可能性があります。

**解決策**:
1. スタックが正常にデプロイされているか確認
2. スタック名が正しいか確認（環境名を確認）

### 環境名が異なる場合

デフォルトは`dev`ですが、異なる環境を使用している場合：

```bash
# 環境変数を設定
export ENVIRONMENT=prod
export APP_NAME=meeting-minutes-generator

# スクリプトを実行
./scripts/get-env-values.sh
```

## 📚 関連ドキュメント

- [クイックスタートガイド](./QUICK_START_CLOUDFRONT.md)
- [CloudFrontデプロイガイド](./CLOUDFRONT_DEPLOYMENT.md)
- [AWS CloudFormation Outputs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html)

## 💡 ヒント

### 環境変数の更新

フロントエンドをビルドする際、これらの環境変数は静的にビルドに埋め込まれます。
値を変更した場合は、フロントエンドを再ビルド・再デプロイする必要があります：

```bash
npm run deploy:frontend
```

### セキュリティ

- これらの環境変数は**公開情報**です（フロントエンドに埋め込まれるため）
- 秘密情報（APIキーなど）は含めないでください
- Cognitoの認証フローで保護されているため、安全です

### 複数環境の管理

開発環境と本番環境で異なる値を使用する場合：

```bash
# .env.dev
NEXT_PUBLIC_API_URL=https://dev-api.example.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_DevPoolId

# .env.prod
NEXT_PUBLIC_API_URL=https://api.example.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_ProdPoolId
```

デプロイ時に適切な`.env`ファイルを使用します。
