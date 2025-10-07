import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
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
  public readonly startProcessingHandler: lambda.Function;
  public readonly minutesGeneratorHandler: lambda.Function;
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
    this.uploadHandler = new nodejs.NodejsFunction(this, 'UploadHandler', {
      functionName: `${appName}-upload-handler-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/upload-handler/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Presigned URLを生成し、ジョブレコードを作成する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Transcribe Trigger Lambda
    this.transcribeTrigger = new nodejs.NodejsFunction(this, 'TranscribeTrigger', {
      functionName: `${appName}-transcribe-trigger-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/transcribe-trigger/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'AWS Transcribeジョブを開始し、話者識別を有効化する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Check Transcribe Status Lambda
    this.checkTranscribeStatus = new nodejs.NodejsFunction(this, 'CheckTranscribeStatus', {
      functionName: `${appName}-check-transcribe-status-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/check-transcribe-status/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Transcribeジョブのステータスをポーリングし、DynamoDBを更新する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Get Job Status Lambda
    this.getJobStatusHandler = new nodejs.NodejsFunction(this, 'GetJobStatusHandler', {
      functionName: `${appName}-get-job-status-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/get-job-status/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '指定されたジョブIDのステータス情報を取得する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // List Jobs Lambda
    this.listJobsHandler = new nodejs.NodejsFunction(this, 'ListJobsHandler', {
      functionName: `${appName}-list-jobs-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/list-jobs/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'ユーザーのジョブ一覧を取得する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Get Minutes Lambda
    this.getMinutesHandler = new nodejs.NodejsFunction(this, 'GetMinutesHandler', {
      functionName: `${appName}-get-minutes-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/get-minutes/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '指定されたジョブIDの議事録を取得する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Download Minutes Lambda
    this.downloadMinutesHandler = new nodejs.NodejsFunction(this, 'DownloadMinutesHandler', {
      functionName: `${appName}-download-minutes-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/download-minutes/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '議事録のダウンロードURL（Presigned URL）を生成する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Minutes Generator Lambda
    this.minutesGeneratorHandler = new nodejs.NodejsFunction(this, 'MinutesGeneratorHandler', {
      functionName: `${appName}-minutes-generator-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/minutes-generator/index.ts'),
      handler: 'handler',
      role: this.lambdaExecutionRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: '文字起こし結果から議事録を生成してS3に保存する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Step Functions ワークフロー定義
    this.stateMachine = this.createStateMachine(appName, environment);

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
      cloudWatchRole: true,
    });

    // /api リソース
    const apiResource = this.api.root.addResource('api');

    // POST /api/upload エンドポイント
    const uploadResource = apiResource.addResource('upload');
    
    // OPTIONSメソッドを明示的に追加（CORSプリフライト用）
    uploadResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });
    
    uploadResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.uploadHandler, {
        proxy: true,
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
    
    // CORSプリフライトを追加
    jobsResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });

    // GET /api/jobs エンドポイント - ジョブ一覧取得
    jobsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.listJobsHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId} エンドポイント - ジョブステータス取得
    const jobIdResource = jobsResource.addResource('{jobId}');
    
    // CORSプリフライトを追加
    jobIdResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });
    
    jobIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.getJobStatusHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId}/minutes エンドポイント - 議事録取得
    const minutesResource = jobIdResource.addResource('minutes');
    
    // CORSプリフライトを追加
    minutesResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'PUT', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });
    
    minutesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.getMinutesHandler, {
        proxy: true,
      })
    );

    // GET /api/jobs/{jobId}/download エンドポイント - ダウンロードURL生成
    const downloadResource = jobIdResource.addResource('download');
    
    // CORSプリフライトを追加
    downloadResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });
    
    downloadResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.downloadMinutesHandler, {
        proxy: true,
      })
    );

    // Start Processing Lambda専用のIAMロール（循環依存を回避）
    const startProcessingRole = new iam.Role(this, 'StartProcessingRole', {
      roleName: `${appName}-start-processing-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Start Processing Lambda',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // DynamoDBとS3へのアクセス権限を付与
    jobsTable.grantReadData(startProcessingRole);
    inputBucket.grantRead(startProcessingRole);

    // Start Processing Lambda（Step Functionsワークフローを起動）
    // 注: API Gateway作成後に作成して循環依存を回避
    this.startProcessingHandler = new nodejs.NodejsFunction(this, 'StartProcessingHandler', {
      functionName: `${appName}-start-processing-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/start-processing/index.ts'),
      handler: 'handler',
      role: startProcessingRole,
      environment: {
        ...lambdaEnvironment,
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'S3アップロード完了後にStep Functionsワークフローを起動する',
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    // Start Processing HandlerにStep Functionsの実行権限を付与
    this.stateMachine.grantStartExecution(this.startProcessingHandler);

    // POST /api/jobs/{jobId}/start エンドポイント - 処理開始
    const startResource = jobIdResource.addResource('start');
    
    // CORSプリフライトを追加
    startResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
    });
    
    startResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.startProcessingHandler, {
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

    // 6. GenerateMinutes ステート - 議事録生成
    const generateMinutesTask = new tasks.LambdaInvoke(this, 'GenerateMinutes', {
      lambdaFunction: this.minutesGeneratorHandler,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
      comment: '文字起こし結果から議事録を生成してS3に保存する',
    });

    // 議事録生成失敗時の処理
    const minutesGenerationFailed = new sfn.Fail(this, 'MinutesGenerationFailed', {
      error: 'MinutesGenerationFailed',
      cause: '議事録生成に失敗しました',
    });

    // エラーハンドリングの設定
    generateMinutesTask.addCatch(minutesGenerationFailed, {
      errors: ['States.ALL'],
      resultPath: '$.error',
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
            generateMinutesTask.next(successState)
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
