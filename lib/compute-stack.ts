import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
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
  public readonly transcribeTrigger: lambda.Function;
  public readonly checkTranscribeStatus: lambda.Function;
  public readonly getJobStatusHandler: lambda.Function;
  public readonly listJobsHandler: lambda.Function;
  public readonly getMinutesHandler: lambda.Function;
  public readonly downloadMinutesHandler: lambda.Function;
  public readonly stateMachine: sfn.StateMachine;

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

    // Lambda環境変数の共通設定（STATE_MACHINE_ARNは後で追加）
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

    // Transcribe Trigger Lambda
    this.transcribeTrigger = new lambda.Function(this, 'TranscribeTrigger', {
      functionName: `${appName}-transcribe-trigger-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/transcribe-trigger')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'AWS Transcribeジョブを開始し、話者識別を有効化する',
    });

    // Check Transcribe Status Lambda
    this.checkTranscribeStatus = new lambda.Function(this, 'CheckTranscribeStatus', {
      functionName: `${appName}-check-transcribe-status-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/check-transcribe-status')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Transcribeジョブのステータスをポーリングし、DynamoDBを更新する',
    });

    // Get Job Status Lambda
    this.getJobStatusHandler = new lambda.Function(this, 'GetJobStatusHandler', {
      functionName: `${appName}-get-job-status-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/get-job-status')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '指定されたジョブIDのステータス情報を取得する',
    });

    // List Jobs Lambda
    this.listJobsHandler = new lambda.Function(this, 'ListJobsHandler', {
      functionName: `${appName}-list-jobs-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/list-jobs')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'ユーザーのジョブ一覧を取得する',
    });

    // Get Minutes Lambda
    this.getMinutesHandler = new lambda.Function(this, 'GetMinutesHandler', {
      functionName: `${appName}-get-minutes-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/get-minutes')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '指定されたジョブIDの議事録を取得する',
    });

    // Download Minutes Lambda
    this.downloadMinutesHandler = new lambda.Function(this, 'DownloadMinutesHandler', {
      functionName: `${appName}-download-minutes-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambdas/download-minutes')),
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '議事録のダウンロードURL（Presigned URL）を生成する',
    });

    // Step Functions ワークフロー定義
    this.stateMachine = this.createStateMachine(appName, environment);

    // Upload HandlerにStep Functions ARNを環境変数として追加
    // 注: 循環依存を避けるため、ARNを直接構築する
    const stateMachineArn = `arn:aws:states:${this.region}:${this.account}:stateMachine:${appName}-workflow-${environment}`;
    this.uploadHandler.addEnvironment('STATE_MACHINE_ARN', stateMachineArn);

    // Upload HandlerにStep Functionsの実行権限を付与
    this.uploadHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [stateMachineArn],
      })
    );

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

    // /api/jobs リソース
    const jobsResource = apiResource.addResource('jobs');

    // GET /api/jobs エンドポイント - ジョブ一覧取得
    jobsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.listJobsHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId} エンドポイント - ジョブステータス取得
    const jobIdResource = jobsResource.addResource('{jobId}');
    jobIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.getJobStatusHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId}/minutes エンドポイント - 議事録取得
    const minutesResource = jobIdResource.addResource('minutes');
    minutesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.getMinutesHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId}/download エンドポイント - ダウンロードURL生成
    const downloadResource = jobIdResource.addResource('download');
    downloadResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.downloadMinutesHandler, {
        proxy: true,
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

    new cdk.CfnOutput(this, 'TranscribeTriggerArn', {
      value: this.transcribeTrigger.functionArn,
      description: 'Transcribe Trigger Lambda ARN',
      exportName: `${appName}-transcribe-trigger-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'CheckTranscribeStatusArn', {
      value: this.checkTranscribeStatus.functionArn,
      description: 'Check Transcribe Status Lambda ARN',
      exportName: `${appName}-check-transcribe-status-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'GetJobStatusHandlerArn', {
      value: this.getJobStatusHandler.functionArn,
      description: 'Get Job Status Lambda ARN',
      exportName: `${appName}-get-job-status-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'ListJobsHandlerArn', {
      value: this.listJobsHandler.functionArn,
      description: 'List Jobs Lambda ARN',
      exportName: `${appName}-list-jobs-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'GetMinutesHandlerArn', {
      value: this.getMinutesHandler.functionArn,
      description: 'Get Minutes Lambda ARN',
      exportName: `${appName}-get-minutes-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'DownloadMinutesHandlerArn', {
      value: this.downloadMinutesHandler.functionArn,
      description: 'Download Minutes Lambda ARN',
      exportName: `${appName}-download-minutes-arn-${environment}`,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'Step Functions State Machine ARN',
      exportName: `${appName}-state-machine-arn-${environment}`,
    });
  }

  /**
   * Step Functionsステートマシンを作成
   */
  private createStateMachine(appName: string, environment: string): sfn.StateMachine {
    // CloudWatch Logsロググループ
    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/vendedlogs/states/${appName}-workflow-${environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 1. TranscribeVideo ステート - Transcribeジョブを開始
    const transcribeVideoTask = new tasks.LambdaInvoke(this, 'TranscribeVideo', {
      lambdaFunction: this.transcribeTrigger,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
      comment: 'AWS Transcribeジョブを開始し、話者識別を有効化する',
    });

    // 2. WaitForTranscription ステート - 30秒待機
    const waitForTranscription = new sfn.Wait(this, 'WaitForTranscription', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
      comment: 'Transcribeジョブの完了を待つ（30秒）',
    });

    // 3. CheckTranscriptionStatus ステート - Transcribeステータスを確認
    const checkTranscriptionStatusTask = new tasks.LambdaInvoke(
      this,
      'CheckTranscriptionStatus',
      {
        lambdaFunction: this.checkTranscribeStatus,
        outputPath: '$.Payload',
        retryOnServiceExceptions: true,
        comment: 'Transcribeジョブのステータスをポーリングし、DynamoDBを更新する',
      }
    );

    // 4. IsTranscriptionComplete ステート - 完了判定
    const isTranscriptionComplete = new sfn.Choice(this, 'IsTranscriptionComplete', {
      comment: 'Transcribeジョブが完了したかどうかを判定',
    });

    // 5. TranscriptionFailed ステート - 失敗時の処理
    const transcriptionFailed = new sfn.Fail(this, 'TranscriptionFailed', {
      error: 'TranscriptionJobFailed',
      cause: 'AWS Transcribeジョブが失敗しました',
    });

    // 6. GenerateMinutes ステート - 議事録生成（将来実装）
    // TODO: Task 6で実装予定
    const generateMinutesPlaceholder = new sfn.Pass(this, 'GenerateMinutes', {
      comment: '議事録生成処理（将来実装予定）',
      result: sfn.Result.fromObject({
        message: '議事録生成は今後実装されます',
      }),
    });

    // 7. Success ステート - 成功
    const successState = new sfn.Succeed(this, 'Success', {
      comment: 'ワークフロー正常完了',
    });

    // エラーハンドリングの設定
    transcribeVideoTask.addCatch(transcriptionFailed, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    checkTranscriptionStatusTask.addCatch(transcriptionFailed, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    // ワークフローの定義
    const definition = transcribeVideoTask
      .next(waitForTranscription)
      .next(checkTranscriptionStatusTask)
      .next(
        isTranscriptionComplete
          .when(
            sfn.Condition.stringEquals('$.status', 'FAILED'),
            transcriptionFailed
          )
          .when(
            sfn.Condition.booleanEquals('$.isComplete', true),
            generateMinutesPlaceholder.next(successState)
          )
          .otherwise(waitForTranscription)
      );

    // ステートマシンの作成
    const stateMachine = new sfn.StateMachine(this, 'MeetingMinutesWorkflow', {
      stateMachineName: `${appName}-workflow-${environment}`,
      definition,
      role: this.stepFunctionsRole,
      timeout: cdk.Duration.hours(2),
      comment: '会議録画から議事録を生成するワークフロー',
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
      tracingEnabled: true,
    });

    return stateMachine;
  }
}
