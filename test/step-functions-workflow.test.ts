/**
 * Step Functions ワークフローのテスト
 */

import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ComputeStack } from '../lib/compute-stack';

describe('Step Functions Workflow', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const storageStack = new StorageStack(app, 'TestStorageStack', {
      environment: 'test',
      appName: 'test-app',
    });

    const computeStack = new ComputeStack(app, 'TestComputeStack', {
      environment: 'test',
      appName: 'test-app',
      inputBucket: storageStack.inputBucket,
      outputBucket: storageStack.outputBucket,
      jobsTable: storageStack.jobsTable,
    });

    template = Template.fromStack(computeStack);
  });

  test('Step Functions State Machine が作成されている', () => {
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
  });

  test('State Machine に正しい名前が設定されている', () => {
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: 'test-app-workflow-test',
    });
  });

  test('State Machine にログ設定がある', () => {
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      LoggingConfiguration: {
        Level: 'ALL',
        IncludeExecutionData: true,
      },
    });
  });

  test('State Machine にトレーシングが有効化されている', () => {
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      TracingConfiguration: {
        Enabled: true,
      },
    });
  });

  test('CloudWatch Logs ロググループが作成されている', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/vendedlogs/states/test-app-workflow-test',
      RetentionInDays: 7,
    });
  });

  test('TranscribeTrigger Lambda が作成されている', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-app-transcribe-trigger-test',
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
      Timeout: 60,
    });
  });

  test('CheckTranscribeStatus Lambda が作成されている', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-app-check-transcribe-status-test',
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
      Timeout: 30,
    });
  });

  test('Step Functions Role に Lambda 実行権限がある', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('Step Functions Role に CloudWatch Logs 権限がある', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining([
              'logs:CreateLogDelivery',
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('UploadHandler に STATE_MACHINE_ARN 環境変数がある', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-app-upload-handler-test',
      Environment: {
        Variables: {
          STATE_MACHINE_ARN: expect.stringContaining('stateMachine:test-app-workflow-test'),
        },
      },
    });
  });

  test('UploadHandler に Step Functions 実行権限がある', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: 'states:StartExecution',
            Effect: 'Allow',
            Resource: expect.stringContaining('stateMachine:test-app-workflow-test'),
          }),
        ]),
      },
    });
  });
});
