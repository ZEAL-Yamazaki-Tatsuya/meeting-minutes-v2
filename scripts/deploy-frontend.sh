#!/bin/bash

# フロントエンドのビルドとデプロイスクリプト

set -e

echo "🚀 フロントエンドのデプロイを開始します..."

# 環境変数の確認
if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "❌ エラー: AWS_ACCOUNT_ID が設定されていません"
  exit 1
fi

if [ -z "$AWS_REGION" ]; then
  echo "❌ エラー: AWS_REGION が設定されていません"
  exit 1
fi

ENVIRONMENT=${ENVIRONMENT:-dev}
APP_NAME=${APP_NAME:-meeting-minutes-generator}

echo "📦 環境: $ENVIRONMENT"
echo "📦 アプリ名: $APP_NAME"

# フロントエンドのビルド
echo "🔨 フロントエンドをビルドしています..."
cd frontend

# 依存関係のインストール
if [ ! -d "node_modules" ]; then
  echo "📥 依存関係をインストールしています..."
  npm ci
fi

# 環境変数の設定（ビルド時に必要）
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-""}
export NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-""}
export NEXT_PUBLIC_COGNITO_USER_POOL_ID=${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-""}
export NEXT_PUBLIC_COGNITO_CLIENT_ID=${NEXT_PUBLIC_COGNITO_CLIENT_ID:-""}
export NEXT_PUBLIC_AWS_REGION=${NEXT_PUBLIC_AWS_REGION:-$AWS_REGION}

# ビルド実行
echo "🔨 Next.jsアプリケーションをビルドしています..."
npm run build

# ビルド結果の確認
if [ ! -d "out" ]; then
  echo "❌ エラー: ビルドに失敗しました（outディレクトリが見つかりません）"
  exit 1
fi

echo "✅ フロントエンドのビルドが完了しました"

# CDKデプロイ
cd ..
echo "☁️ CloudFrontとS3にデプロイしています..."
npx cdk deploy ${APP_NAME}-frontend-${ENVIRONMENT} --require-approval never

echo "✅ デプロイが完了しました！"

# CloudFrontのURLを取得
DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name ${APP_NAME}-frontend-${ENVIRONMENT} \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text \
  --region ${AWS_REGION})

if [ -n "$DISTRIBUTION_DOMAIN" ]; then
  echo ""
  echo "🌐 フロントエンドURL: https://${DISTRIBUTION_DOMAIN}"
  echo ""
fi

echo "✨ すべての処理が完了しました！"
