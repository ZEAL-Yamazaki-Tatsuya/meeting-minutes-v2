import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  inputBucket: s3.IBucket;
  outputBucket: s3.IBucket;
  jobsTable: dynamodb.ITable;
  corsAllowedOrigins?: string[];
}

export class ComputeStack extends cdk.Stack {
  public readonly lambdaExecutionRole: iam.Role;
  public readonly transcribeRole: iam.Role;
  public readonly stepFunctionsRole: iam.Role;
  public readonly api: apigateway.RestApi;
  public readonly uploadHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { environment, appName, inputBucket, outputBucket, jobsTable, corsAllowedOrigins } = props;

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

    // Lambda環境変数の共通設定
    const lambdaEnvironment = {
      ENVIRONMENT: environment,
      INPUT_BUCKET_NAME: inputBucket.bucketName,
      OUTPUT_BUCKET_NAME: outputBucket.bucketName,
      JOBS_TABLE_NAME: jobsTable.tableName,
      MAX_FILE_SIZE_MB: '2048',
      ALLOWED_FILE_TYPES: 'video/mp4',
    };

    // Upload Handler Lambda
    this.uploadHandler = new lambda.Function(this, 'UploadHandler', {
      functionName: `${appName}-upload-handler-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/upload-handler')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Presigned URLを生成し、ジョブレコードを作成する',
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'MeetingMinutesApi', {
      restApiName: `${appName}-api-${environment}`,
      description: 'Meeting Minutes Generator API',
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: corsAllowedOrigins || ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // /api リソース
    const apiResource = this.api.root.addResource('api');

    // POST /api/upload エンドポイント
    const uploadResource = apiResource.addResource('upload');
    uploadResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.uploadHandler, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
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

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${appName}-api-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'UploadHandlerArn', {
      value: this.uploadHandler.functionArn,
      description: 'Upload Handler Lambda ARN',
      exportName: `${appName}-upload-handler-arn-${environment}`,
    });
  }
}
