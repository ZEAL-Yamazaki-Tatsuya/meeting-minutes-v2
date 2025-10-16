#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { StorageStack } from '../lib/storage-stack';
import { ComputeStack } from '../lib/compute-stack';
import { AuthStack } from '../lib/auth-stack';

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

// Add tags to all resources
cdk.Tags.of(app).add('Application', appName);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
