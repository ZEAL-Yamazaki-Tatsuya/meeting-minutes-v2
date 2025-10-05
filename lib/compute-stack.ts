import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  inputBucket: s3.IBucket;
  outputBucket: s3.IBucket;
  jobsTable: dynamodb.ITable;
}

export class ComputeStack extends cdk.Stack {
  public readonly lambdaExecutionRole: iam.Role;
  public readonly transcribeRole: iam.Role;
  public readonly stepFunctionsRole: iam.Role;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { environment, appName, inputBucket, outputBucket, jobsTable } = props;

    // IAM Role for Lambda functions
    this.lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `${appName}-lambda-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Meeting Minutes Generator Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Lambda access to S3 buckets
    inputBucket.grantReadWrite(this.lambdaExecutionRole);
    outputBucket.grantReadWrite(this.lambdaExecutionRole);

    // Grant Lambda access to DynamoDB table
    jobsTable.grantReadWriteData(this.lambdaExecutionRole);

    // Grant Lambda access to Transcribe
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'transcribe:ListTranscriptionJobs',
        ],
        resources: ['*'],
      })
    );

    // Grant Lambda access to Bedrock
    this.lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // IAM Role for AWS Transcribe
    this.transcribeRole = new iam.Role(this, 'TranscribeRole', {
      roleName: `${appName}-transcribe-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('transcribe.amazonaws.com'),
      description: 'Role for AWS Transcribe to access S3 buckets',
    });

    // Grant Transcribe access to S3 buckets
    inputBucket.grantRead(this.transcribeRole);
    outputBucket.grantWrite(this.transcribeRole);

    // IAM Role for Step Functions
    this.stepFunctionsRole = new iam.Role(this, 'StepFunctionsRole', {
      roleName: `${appName}-stepfunctions-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'Execution role for Step Functions workflow',
    });

    // Grant Step Functions permission to invoke Lambda functions
    this.stepFunctionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${this.region}:${this.account}:function:${appName}-*`],
      })
    );

    // Grant Step Functions access to CloudWatch Logs
    this.stepFunctionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'LambdaExecutionRoleArn', {
      value: this.lambdaExecutionRole.roleArn,
      description: 'Lambda execution role ARN',
      exportName: `${appName}-lambda-role-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'TranscribeRoleArn', {
      value: this.transcribeRole.roleArn,
      description: 'Transcribe role ARN',
      exportName: `${appName}-transcribe-role-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'StepFunctionsRoleArn', {
      value: this.stepFunctionsRole.roleArn,
      description: 'Step Functions role ARN',
      exportName: `${appName}-stepfunctions-role-arn-${environment}`,
    });
  }
}
