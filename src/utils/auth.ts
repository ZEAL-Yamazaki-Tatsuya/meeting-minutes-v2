/**
 * 認証ユーティリティ
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * API Gateway イベントからユーザーIDを取得
 * Cognito Authorizerが設定されている場合、requestContextからユーザーIDを取得
 * 設定されていない場合は、リクエストボディから取得
 */
export function getUserIdFromEvent(event: APIGatewayProxyEvent): string | null {
  // Cognito Authorizerが設定されている場合
  if (event.requestContext.authorizer) {
    // Cognito User Poolsの場合
    const claims = event.requestContext.authorizer.claims;
    if (claims && claims.sub) {
      return claims.sub; // Cognito User ID (sub claim)
    }
  }

  return null;
}

/**
 * API Gateway イベントからユーザーのメールアドレスを取得
 */
export function getUserEmailFromEvent(event: APIGatewayProxyEvent): string | null {
  if (event.requestContext.authorizer) {
    const claims = event.requestContext.authorizer.claims;
    if (claims && claims.email) {
      return claims.email;
    }
  }

  return null;
}

/**
 * API Gateway イベントから認証情報を取得
 */
export interface AuthInfo {
  userId: string;
  email?: string;
  name?: string;
}

export function getAuthInfoFromEvent(event: APIGatewayProxyEvent): AuthInfo | null {
  if (event.requestContext.authorizer) {
    const claims = event.requestContext.authorizer.claims;
    if (claims && claims.sub) {
      return {
        userId: claims.sub,
        email: claims.email,
        name: claims.name,
      };
    }
  }

  return null;
}
