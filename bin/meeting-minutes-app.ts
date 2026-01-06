#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { StorageStack } from '../lib/storage-stack';
import { ComputeStack } from '../lib/compute-stack';
import { AuthStack } from '../lib/auth-stack';
import { AmplifyFrontendStack } from '../lib/amplify-frontend-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

// Load environment variables
dotenv.config();

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const environment = process.env.ENVIRONMENT || 'dev';
const appName = process.env.APP_NAME || 'meeting-minutes-generator';

// Create stacks
const storageStack = new StorageStack(app, `${appName}-storage-${environment}`, {
  env,
  environment,
  appName,
  description: 'Storage resources for Meeting Minutes Generator (S3, DynamoDB)',
});

// Cognito認証スタック
const authStack = new AuthStack(app, `${appName}-auth-${environment}`, {
  env,
  environment,
  appName,
  callbackUrls: process.env.COGNITO_CALLBACK_URLS?.split(',') || ['http://localhost:3000/auth/callback'],
  logoutUrls: process.env.COGNITO_LOGOUT_URLS?.split(',') || ['http://localhost:3000'],
  description: 'Authentication resources for Meeting Minutes Generator (Cognito)',
});

const computeStack = new ComputeStack(app, `${appName}-compute-${environment}`, {
  env,
  environment,
  appName,
  inputBucket: storageStack.inputBucket,
  outputBucket: storageStack.outputBucket,
  jobsTable: storageStack.jobsTable,
  userPoolArn: authStack.userPool.userPoolArn, // Cognito認証を有効化
  description: 'Compute resources for Meeting Minutes Generator (Lambda, Step Functions)',
});

// モニタリングスタック（CloudWatch、X-Ray）
const monitoringStack = new MonitoringStack(app, `${appName}-monitoring-${environment}`, {
  env,
  environment,
  appName,
  uploadHandler: computeStack.uploadHandler,
  transcribeTrigger: computeStack.transcribeTrigger,
  checkTranscribeStatus: computeStack.checkTranscribeStatus,
  minutesGeneratorHandler: computeStack.minutesGeneratorHandler,
  getJobStatusHandler: computeStack.getJobStatusHandler,
  listJobsHandler: computeStack.listJobsHandler,
  getMinutesHandler: computeStack.getMinutesHandler,
  downloadMinutesHandler: computeStack.downloadMinutesHandler,
  startProcessingHandler: computeStack.startProcessingHandler,
  api: computeStack.api,
  stateMachine: computeStack.stateMachine,
  alertEmail: process.env.ALERT_EMAIL, // アラート通知先メールアドレス
  description: 'Monitoring resources for Meeting Minutes Generator (CloudWatch, X-Ray)',
});

monitoringStack.addDependency(computeStack);

// フロントエンドスタック（AWS Amplify Hosting）
const amplifyStack = new AmplifyFrontendStack(app, `${appName}-amplify-${environment}`, {
  env,
  environment,
  appName,
  apiUrl: computeStack.apiUrl,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
  githubRepo: process.env.GITHUB_REPO,
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  githubToken: process.env.GITHUB_TOKEN,
  description: 'Frontend hosting resources for Meeting Minutes Generator (Amplify)',
});

amplifyStack.addDependency(computeStack);
amplifyStack.addDependency(authStack);

// Add tags to all resources for cost tracking and management
cdk.Tags.of(app).add('Application', 'meeting-minutes-generator');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Project', 'meeting-minutes-generator');
cdk.Tags.of(app).add('CostCenter', 'Development');
cdk.Tags.of(app).add('Owner', process.env.OWNER_EMAIL || 'admin');
