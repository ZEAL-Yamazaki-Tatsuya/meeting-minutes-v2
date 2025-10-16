// Cognito認証ユーティリティ

interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

interface User {
  userId: string;
  email: string;
  name?: string;
}

// Cognito設定を環境変数から取得
export function getCognitoConfig(): CognitoConfig {
  return {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  };
}

// ローカルストレージのキー
const STORAGE_KEYS = {
  ID_TOKEN: 'cognito_id_token',
  ACCESS_TOKEN: 'cognito_access_token',
  REFRESH_TOKEN: 'cognito_refresh_token',
  USER: 'cognito_user',
};

/**
 * トークンをローカルストレージに保存
 */
export function saveTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
}

/**
 * トークンをローカルストレージから取得
 */
export function getTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  
  const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  
  if (!idToken || !accessToken || !refreshToken) {
    return null;
  }
  
  return { idToken, accessToken, refreshToken };
}

/**
 * トークンをクリア
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * ユーザー情報を保存
 */
export function saveUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * ユーザー情報を取得
 */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * JWTトークンをデコード
 */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * トークンの有効期限をチェック
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || typeof decoded.exp !== 'number') return true;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * 現在のユーザーが認証されているかチェック
 */
export function isAuthenticated(): boolean {
  const tokens = getTokens();
  if (!tokens) return false;
  
  return !isTokenExpired(tokens.idToken);
}

/**
 * Cognitoにサインアップ
 */
export async function signUp(email: string, password: string, name?: string): Promise<void> {
  const config = getCognitoConfig();
  
  // Cognito User Pools APIを使用してサインアップ
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
      body: JSON.stringify({
        ClientId: config.clientId,
        Username: email,
        Password: password,
        UserAttributes: name
          ? [
              { Name: 'email', Value: email },
              { Name: 'name', Value: name },
            ]
          : [{ Name: 'email', Value: email }],
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'サインアップに失敗しました');
  }
}

/**
 * メールアドレス確認
 */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  const config = getCognitoConfig();
  
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
      },
      body: JSON.stringify({
        ClientId: config.clientId,
        Username: email,
        ConfirmationCode: code,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '確認に失敗しました');
  }
}

/**
 * Cognitoにサインイン
 */
export async function signIn(email: string, password: string): Promise<User> {
  const config = getCognitoConfig();
  
  // SRP認証の代わりに、USER_PASSWORD_AUTH フローを使用（簡易実装）
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'サインインに失敗しました');
  }
  
  const data = await response.json();
  
  if (!data.AuthenticationResult) {
    throw new Error('認証に失敗しました');
  }
  
  const tokens: AuthTokens = {
    idToken: data.AuthenticationResult.IdToken,
    accessToken: data.AuthenticationResult.AccessToken,
    refreshToken: data.AuthenticationResult.RefreshToken,
  };
  
  saveTokens(tokens);
  
  // IDトークンからユーザー情報を抽出
  const idTokenPayload = decodeJWT(tokens.idToken);
  if (!idTokenPayload) {
    throw new Error('Invalid ID token');
  }
  
  const user: User = {
    userId: idTokenPayload.sub as string,
    email: idTokenPayload.email as string,
    name: idTokenPayload.name as string | undefined,
  };
  
  saveUser(user);
  
  return user;
}

/**
 * サインアウト
 */
export async function signOut(): Promise<void> {
  const config = getCognitoConfig();
  const tokens = getTokens();
  
  if (tokens) {
    try {
      // Cognitoからグローバルサインアウト
      await fetch(
        `https://cognito-idp.${config.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.GlobalSignOut',
          },
          body: JSON.stringify({
            AccessToken: tokens.accessToken,
          }),
        }
      );
    } catch (error) {
      console.error('サインアウトエラー:', error);
    }
  }
  
  clearTokens();
}

/**
 * トークンをリフレッシュ
 */
export async function refreshTokens(): Promise<AuthTokens> {
  const config = getCognitoConfig();
  const tokens = getTokens();
  
  if (!tokens) {
    throw new Error('リフレッシュトークンがありません');
  }
  
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          REFRESH_TOKEN: tokens.refreshToken,
        },
      }),
    }
  );
  
  if (!response.ok) {
    clearTokens();
    throw new Error('トークンのリフレッシュに失敗しました');
  }
  
  const data = await response.json();
  
  const newTokens: AuthTokens = {
    idToken: data.AuthenticationResult.IdToken,
    accessToken: data.AuthenticationResult.AccessToken,
    refreshToken: tokens.refreshToken, // リフレッシュトークンは変わらない
  };
  
  saveTokens(newTokens);
  
  return newTokens;
}

/**
 * 認証ヘッダーを取得（API呼び出し用）
 */
export async function getAuthHeader(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  
  // トークンが期限切れの場合はリフレッシュ
  if (isTokenExpired(tokens.idToken)) {
    try {
      const newTokens = await refreshTokens();
      return newTokens.idToken;
    } catch {
      return null;
    }
  }
  
  return tokens.idToken;
}
