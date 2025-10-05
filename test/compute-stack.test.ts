import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ComputeStack } from '../lib/compute-stack';

describe('ComputeStack', () => {
  let app: cdk.App;
  let stack: ComputeStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    
    // Create mock resources
    const mockBucket = s3.Bucket.fromBucketName(app, 'MockBucket', 'mock-bucket');
    const mockTable = dynamodb.Table.fromTableName(app, 'MockTable', 'mock-table');

    stack = new ComputeStack(app, 'TestComputeStack', {
      environment: 'test',
      appName: 'test-app',
      inputBucket: mockBucket,
      outputBucket: mockBucket,
      jobsTable: mockTable,
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    template = Template.fromStack(stack);
  });

  test('creates Lambda execution role', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumedBy: {
        Service: 'lambda.amazonaws.com',
      },
    });
  });

  test('creates Transcribe role', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumedBy: {
        Service: 'transcribe.amazonaws.com',
      },
    });
  });

  test('creates Step Functions role', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumedBy: {
        Service: 'states.amazonaws.com',
      },
    });
  });

  test('Lambda role has Bedrock permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: cdk.Match.arrayWith([
          cdk.Match.objectLike({
            Action: [
              'bedrock:InvokeModel',
              'bedrock:InvokeModelWithResponseStream',
            ],
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('Lambda role has Transcribe permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: cdk.Match.arrayWith([
          cdk.Match.objectLike({
            Action: [
              'transcribe:StartTranscriptionJob',
              'transcribe:GetTranscriptionJob',
              'transcribe:ListTranscriptionJobs',
            ],
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('creates CloudFormation outputs', () => {
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContain('LambdaExecutionRoleArn');
    expect(Object.keys(outputs)).toContain('TranscribeRoleArn');
    expect(Object.keys(outputs)).toContain('StepFunctionsRoleArn');
  });
});
