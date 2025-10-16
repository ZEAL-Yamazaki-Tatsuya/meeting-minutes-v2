import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';

export interface AmplifyFrontendStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  apiUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  githubRepo?: string;
  githubBranch?: string;
  githubToken?: string;
}

/**
 * AWS Amplify Hostingを使用したフロントエンドスタック
 * Next.jsアプリケーションを自動的にビルド・デプロイ
 */
export class AmplifyFrontendStack extends cdk.Stack {
  public readonly amplifyApp: amplify.CfnApp;
  public readonly amplifyBranch: amplify.CfnBranch;
  public readonly appUrl: string;

  constructor(scope: Construct, id: string, props: AmplifyFrontendStackProps) {
    super(scope, id, props);

    const { environment, appName, apiUrl, cognitoUserPoolId, cognitoClientId } = props;

    // Amplify用のIAMロール
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Role for Amplify to access AWS resources',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    // 環境変数の設定
    const environmentVariables = [
      { name: 'NEXT_PUBLIC_API_URL', value: apiUrl },
      { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', value: cognitoUserPoolId },
      { name: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', value: cognitoClientId },
      { name: 'NEXT_PUBLIC_AWS_REGION', value: this.region },
      { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'frontend' },
      { name: 'AMPLIFY_DIFF_DEPLOY', value: 'false' },
      { name: '_LIVE_UPDATES', value: JSON.stringify([{ pkg: 'next', type: 'internal', version: 'latest' }]) },
    ];

    // Amplifyアプリケーションの作成
    this.amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name: `${appName}-${environment}`,
      description: `Meeting Minutes Generator Frontend (${environment})`,
      platform: 'WEB_COMPUTE',
      iamServiceRole: amplifyRole.roleArn,
      
      // ビルド設定（monorepo形式）
      buildSpec: cdk.Fn.sub(`version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*`),
      
      // 環境変数
      environmentVariables: environmentVariables.map(env => ({
        name: env.name,
        value: env.value,
      })),
      
      // カスタムルール（SPAルーティング用）
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: '404-200',
        },
      ],
      
      // 自動ブランチ作成を無効化
      enableBranchAutoDeletion: false,
    });

    // GitHubリポジトリが指定されている場合
    if (props.githubRepo && props.githubToken) {
      // GitHubトークンをSecrets Managerに保存することを推奨
      this.amplifyApp.accessToken = props.githubToken;
      this.amplifyApp.repository = props.githubRepo;
      
      // ブランチの作成
      this.amplifyBranch = new amplify.CfnBranch(this, 'AmplifyBranch', {
        appId: this.amplifyApp.attrAppId,
        branchName: props.githubBranch || 'main',
        enableAutoBuild: true,
        enablePullRequestPreview: false,
        stage: environment === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT',
      });
      
      this.appUrl = `https://${props.githubBranch || 'main'}.${this.amplifyApp.attrDefaultDomain}`;
    } else {
      // 手動デプロイの場合
      this.amplifyBranch = new amplify.CfnBranch(this, 'AmplifyBranch', {
        appId: this.amplifyApp.attrAppId,
        branchName: environment,
        enableAutoBuild: false,
        stage: environment === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT',
      });
      
      this.appUrl = `https://${environment}.${this.amplifyApp.attrDefaultDomain}`;
    }

    // Outputs
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.attrAppId,
      description: 'Amplify App ID',
      exportName: `${appName}-amplify-app-id-${environment}`,
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: this.appUrl,
      description: 'Amplify App URL',
      exportName: `${appName}-amplify-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'AmplifyConsoleUrl', {
      value: `https://console.aws.amazon.com/amplify/home?region=${this.region}#/${this.amplifyApp.attrAppId}`,
      description: 'Amplify Console URL',
    });

    // Add stack-specific tags
    cdk.Tags.of(this).add('Stack', 'Frontend');
    cdk.Tags.of(this).add('Component', 'Frontend');
    cdk.Tags.of(this).add('Service', 'Amplify');
  }
}
