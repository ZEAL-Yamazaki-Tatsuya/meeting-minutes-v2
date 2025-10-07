#!/bin/bash
# MFA認証を使用してAWS一時認証情報を取得し、環境変数に設定するスクリプト

# 使用方法チェック
if [ $# -ne 3 ]; then
    echo "使用方法: $0 <profile-name> <mfa-serial-number> <token-code>"
    echo "例: $0 my-profile arn:aws:iam::123456789012:mfa/user 123456"
    exit 1
fi

PROFILE_NAME=$1
MFA_SERIAL_NUMBER=$2
TOKEN_CODE=$3

echo "MFA認証情報を取得中..."

# AWS STSコマンドを実行して一時認証情報を取得
OUTPUT=$(aws sts get-session-token \
    --profile "$PROFILE_NAME" \
    --serial-number "$MFA_SERIAL_NUMBER" \
    --token-code "$TOKEN_CODE" \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo "エラー: AWS STSコマンドが失敗しました"
    echo "$OUTPUT"
    exit 1
fi

# JSONから認証情報を抽出
export AWS_ACCESS_KEY_ID=$(echo "$OUTPUT" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$OUTPUT" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$OUTPUT" | jq -r '.Credentials.SessionToken')
EXPIRATION=$(echo "$OUTPUT" | jq -r '.Credentials.Expiration')

echo ""
echo "✓ 認証情報を環境変数に設定しました"
echo ""
echo "有効期限: $EXPIRATION"
echo ""
echo "以下のコマンドを実行して環境変数を設定してください:"
echo ""
echo "export AWS_ACCESS_KEY_ID='$AWS_ACCESS_KEY_ID'"
echo "export AWS_SECRET_ACCESS_KEY='$AWS_SECRET_ACCESS_KEY'"
echo "export AWS_SESSION_TOKEN='$AWS_SESSION_TOKEN'"
echo ""
echo "または、以下のコマンドでこのスクリプトをsourceしてください:"
echo "source $0 $PROFILE_NAME $MFA_SERIAL_NUMBER $TOKEN_CODE"
