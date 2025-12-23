# 認証機能のセットアップガイド

このドキュメントでは、Meeting Minutes GeneratorのAmazon Cognito認証機能のセットアップ方法を説明します。

## 概要

このアプリケーションは、Amazon Cognitoを使用してユーザー認証を実装しています。以下の機能が含まれます：

- ✅ ユーザー登録（サインアップ）- 自己登録可能
- ✅ メールアドレス確認（6桁コード）
- ✅ サインイン/サインアウト
- ✅ JWTトークン管理
- ✅ 保護されたAPIエンドポイント（Cognito Authorizer）
- ✅ 保護されたフロントエンドルート
- ✅ パスワードリセット機能
- ⚠️ MFA（多要素認証）- オプション（TOTP）

## アーキテクチャ

```
┌─────────────┐
│   ユーザー   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Next.js Frontend   │
│  - サインアップ/    │
│    サインインUI     │
│  - JWTトークン管理  │
└──────┬──────────────┘
       │ JWT Token
       ▼
┌─────────────────────┐
│  API Gateway        │
│  + Cognito          │
│    Authorizer       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Lambda Functions   │
│  - ユーザーID取得   │
│  - リソースアクセス │
└─────────────────────┘
```

## セットアップ手順

### 1. Cognitoスタックのデプロイ

認証機能を有効にするには、まずCognitoスタックをデプロイします。

```bash
# 環境変数を設定（オプション）
export COGNITO_CALLBACK_URLS=http://localhost:3000/auth/callback,https://yourdomain.com/auth/callback
export COGNITO_LOGOUT_URLS=http://localhost:3000,https://yourdomain.com

# CDKデプロイ
npm run cdk deploy meeting-minutes-generator-auth-dev
```

デプロイが完了すると、以下の情報が出力されます：

- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito User Pool Client ID
- `UserPoolDomainUrl`: Cognito Hosted UI URL

### 2. 環境変数の設定

#### バックエンド（.env）

```bash
# Cognito設定（オプション）
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CALLBACK_URLS=http://localhost:3000/auth/callback
COGNITO_LOGOUT_URLS=http://localhost:3000
```

#### フロントエンド（frontend/.env.local）

```bash
# API Gateway URL
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/dev

# Cognito設定
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
```

### 3. Computeスタックの再デプロイ

Cognito Authorizerを有効にするため、Computeスタックを再デプロイします。

```bash
npm run cdk deploy meeting-minutes-generator-compute-dev
```

### 4. フロントエンドの起動

```bash
cd frontend
npm run dev
```

## 使用方法

### ユーザー登録（自己登録）

1. ブラウザで `http://localhost:3000` または本番URLにアクセス
2. 「新規登録」ボタンをクリック
3. 以下の情報を入力：
   - メールアドレス
   - パスワード（8文字以上、大文字・小文字・数字を含む）
   - パスワード（確認）
4. 「アカウント作成」をクリック
5. メールで送信された6桁の確認コードを入力
6. 「確認」をクリック

**注意**: 
- 誰でも自己登録できます（`selfSignUpEnabled: true`）
- メールアドレスの確認が必須です
- パスワードポリシーを満たす必要があります

### サインイン

1. 「サインイン」ボタンをクリック
2. メールアドレスとパスワードを入力
3. サインイン後、保護されたページにアクセス可能

### 保護されたページ

以下のページは認証が必要です：

- `/upload` - ファイルアップロード
- `/jobs` - ジョブ一覧
- `/jobs/[jobId]` - ジョブ詳細
- `/jobs/[jobId]/minutes` - 議事録表示

認証されていない場合、自動的にサインインページにリダイレクトされます。

## API認証

### Lambda関数でのユーザーID取得

Lambda関数では、`getUserIdFromEvent`ユーティリティを使用してユーザーIDを取得できます：

```typescript
import { getUserIdFromEvent } from '../../utils/auth';

export const handler = async (event: APIGatewayProxyEvent) => {
  // Cognito認証からユーザーIDを取得
  const userId = getUserIdFromEvent(event);
  
  if (!userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: '認証が必要です' }),
    };
  }
  
  // ユーザーIDを使用してリソースにアクセス
  // ...
};
```

### フロントエンドでのAPI呼び出し

フロントエンドでは、`api-client.ts`が自動的にJWTトークンをリクエストヘッダーに追加します：

```typescript
import apiService from '@/lib/api-service';

// 自動的にAuthorizationヘッダーが追加される
const jobs = await apiService.listJobs();
```

## トラブルシューティング

### 認証エラー

**問題**: サインインできない

**解決策**:
1. Cognito User Pool IDとClient IDが正しく設定されているか確認
2. パスワードポリシーを満たしているか確認（8文字以上、大文字・小文字・数字を含む）
3. メールアドレスが確認されているか確認

### トークンの有効期限切れ

**問題**: APIリクエストが401エラーを返す

**解決策**:
- トークンは自動的にリフレッシュされます
- リフレッシュトークンが期限切れの場合は、再度サインインが必要です

### CORS エラー

**問題**: ブラウザでCORSエラーが発生

**解決策**:
1. API GatewayのCORS設定を確認
2. `CORS_ALLOWED_ORIGINS`環境変数にフロントエンドのURLが含まれているか確認

## セキュリティのベストプラクティス

1. **パスワードポリシー**: 強力なパスワードポリシーを設定（デフォルト: 8文字以上、大文字・小文字・数字）
2. **メール確認**: 自己登録時にメールアドレスの確認を必須化
3. **MFA**: 本番環境ではMFAを有効化することを推奨（現在はオプション）
4. **トークンの有効期限**: 
   - アクセストークン: 1時間
   - IDトークン: 1時間
   - リフレッシュトークン: 30日間
5. **HTTPS**: 本番環境では必ずHTTPSを使用
6. **環境変数**: 機密情報は環境変数で管理し、コードにハードコードしない
7. **IP制限**: VPN接続を必須にすることでアクセスを制限（現在の設定）
8. **レート制限**: API Gatewayでレート制限を設定（本番環境推奨）

## 管理者承認制への変更

現在は自己登録可能ですが、管理者承認制に変更することも可能です：

### 変更方法

`lib/auth-stack.ts`を編集：

```typescript
this.userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: `${appName}-users-${environment}`,
  selfSignUpEnabled: false, // 自己登録を無効化
  // ...
});
```

### 管理者によるユーザー作成

```bash
# AWS CLIでユーザーを作成
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

または、AWS Management Consoleから作成できます。

## 認証の無効化

認証機能を無効にする場合：

1. `bin/meeting-minutes-app.ts`で`userPoolArn`を削除
2. Computeスタックを再デプロイ
3. フロントエンドの保護ルートを削除

```typescript
// bin/meeting-minutes-app.ts
const computeStack = new ComputeStack(app, `${appName}-compute-${environment}`, {
  // ...
  // userPoolArn: authStack.userPool.userPoolArn, // この行をコメントアウト
});
```

## 参考資料

- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS CDK Cognito Construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html)
- [API Gateway Cognito Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)
