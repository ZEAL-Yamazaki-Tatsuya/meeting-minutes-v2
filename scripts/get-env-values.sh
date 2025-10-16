#!/bin/bash

# バックエンドスタックから環境変数の値を取得するスクリプト

set -e

echo "🔍 バックエンドスタックから環境変数を取得しています..."

# 環境変数の確認
if [ -z "$AWS_REGION" ]; then
  AWS_REGION="us-east-1"
  echo "⚠️ AWS_REGIONが設定されていないため、デフォルト値 'us-east-1' を使用します"
fi

ENVIRONMENT=${ENVIRONMENT:-dev}
APP_NAME=${APP_NAME:-meeting-minutes-generator}

echo "📦 環境: $ENVIRONMENT"
echo "📦 アプリ名: $APP_NAME"
echo "📦 リージョン: $AWS_REGION"
echo ""

# 1. API URL の取得
echo "1️⃣ API URLを取得しています..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${APP_NAME}-compute-${ENVIRONMENT} \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "")

if [ -n "$API_URL" ]; then
  echo "   ✅ NEXT_PUBLIC_API_URL=$API_URL"
else
  echo "   ❌ API URLが見つかりませんでした"
  echo "   💡 ComputeStackがデプロイされているか確認してください"
fi

echo ""

# 2. Cognito User Pool ID の取得
echo "2️⃣ Cognito User Pool IDを取得しています..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${APP_NAME}-auth-${ENVIRONMENT} \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ]; then
  echo "   ✅ NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
else
  echo "   ❌ User Pool IDが見つかりませんでした"
  echo "   💡 AuthStackがデプロイされているか確認してください"
fi

echo ""

# 3. Cognito Client ID の取得
echo "3️⃣ Cognito Client IDを取得しています..."
CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name ${APP_NAME}-auth-${ENVIRONMENT} \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "")

if [ -n "$CLIENT_ID" ]; then
  echo "   ✅ NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
else
  echo "   ❌ Client IDが見つかりませんでした"
  echo "   💡 AuthStackがデプロイされているか確認してください"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 .envファイルに追加する内容:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$API_URL" ]; then
  echo "NEXT_PUBLIC_API_URL=$API_URL"
fi
if [ -n "$USER_POOL_ID" ]; then
  echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
fi
if [ -n "$CLIENT_ID" ]; then
  echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
fi
echo "NEXT_PUBLIC_AWS_REGION=$AWS_REGION"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# .envファイルに自動追加するか確認
read -p "💡 これらの値を.envファイルに自動的に追加しますか？ (y/N): " response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
  echo ""
  echo "📝 .envファイルを更新しています..."
  
  # .envファイルが存在しない場合は作成
  if [ ! -f ".env" ]; then
    echo "   .envファイルが存在しないため、新規作成します"
    cp .env.example .env
  fi
  
  # 既存の値をコメントアウトして新しい値を追加
  if [ -n "$API_URL" ]; then
    sed -i.bak 's/^NEXT_PUBLIC_API_URL=/# NEXT_PUBLIC_API_URL=/' .env 2>/dev/null || true
    echo "NEXT_PUBLIC_API_URL=$API_URL" >> .env
  fi
  
  if [ -n "$USER_POOL_ID" ]; then
    sed -i.bak 's/^NEXT_PUBLIC_COGNITO_USER_POOL_ID=/# NEXT_PUBLIC_COGNITO_USER_POOL_ID=/' .env 2>/dev/null || true
    echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID" >> .env
  fi
  
  if [ -n "$CLIENT_ID" ]; then
    sed -i.bak 's/^NEXT_PUBLIC_COGNITO_CLIENT_ID=/# NEXT_PUBLIC_COGNITO_CLIENT_ID=/' .env 2>/dev/null || true
    echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID" >> .env
  fi
  
  sed -i.bak 's/^NEXT_PUBLIC_AWS_REGION=/# NEXT_PUBLIC_AWS_REGION=/' .env 2>/dev/null || true
  echo "NEXT_PUBLIC_AWS_REGION=$AWS_REGION" >> .env
  
  # バックアップファイルを削除
  rm -f .env.bak
  
  echo "   ✅ .envファイルを更新しました"
  echo ""
else
  echo ""
  echo "💡 上記の値を手動で.envファイルにコピーしてください"
  echo ""
fi

echo "✨ 完了しました！"
echo ""
echo "📚 次のステップ:"
echo "   1. .envファイルを確認"
echo "   2. フロントエンドをデプロイ: npm run deploy:frontend"
echo ""
