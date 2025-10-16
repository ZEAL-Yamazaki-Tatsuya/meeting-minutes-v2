import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  callbackUrls?: string[];
  logoutUrls?: string[];
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { environment, appName, callbackUrls, logoutUrls } = props;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${appName}-users-${environment}`,
      selfSignUpEnabled: true, // ユーザーが自分でサインアップできる
      signInAliases: {
        email: true, // メールアドレスでサインイン
        username: false,
      },
      autoVerify: {
        email: true, // メールアドレスを自動検証
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL, // MFAはオプション
      mfaSecondFactor: {
        sms: false,
        otp: true, // TOTPアプリによるMFA
      },
      userVerification: {
        emailSubject: '会議議事録ジェネレーター - メールアドレスの確認',
        emailBody: '認証コード: {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      userInvitation: {
        emailSubject: '会議議事録ジェネレーターへようこそ',
        emailBody: 'ユーザー名: {username}、仮パスワード: {####}',
      },
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPoolClientName: `${appName}-client-${environment}`,
      userPool: this.userPool,
      generateSecret: false, // SPAなのでシークレット不要
      authFlows: {
        userPassword: true, // ユーザー名・パスワード認証
        userSrp: true, // SRP認証
        custom: false,
        adminUserPassword: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: callbackUrls || [
          'http://localhost:3000/auth/callback',
        ],
        logoutUrls: logoutUrls || [
          'http://localhost:3000',
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // User Pool Domain（Cognitoホスト型UI用）
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `${appName}-${environment}-${this.account}`.toLowerCase(),
      },
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${appName}-user-pool-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${appName}-user-pool-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${appName}-user-pool-client-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain URL',
      exportName: `${appName}-user-pool-domain-url-${environment}`,
    });
  }
}
