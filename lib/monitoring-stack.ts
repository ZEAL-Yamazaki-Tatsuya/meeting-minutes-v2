import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  
  // Lambda関数
  uploadHandler: lambda.IFunction;
  transcribeTrigger: lambda.IFunction;
  checkTranscribeStatus: lambda.IFunction;
  minutesGeneratorHandler: lambda.IFunction;
  getJobStatusHandler: lambda.IFunction;
  listJobsHandler: lambda.IFunction;
  getMinutesHandler: lambda.IFunction;
  downloadMinutesHandler: lambda.IFunction;
  startProcessingHandler: lambda.IFunction;
  
  // API Gateway
  api: apigateway.IRestApi;
  
  // Step Functions
  stateMachine: sfn.IStateMachine;
  
  // アラート通知先メールアドレス（オプション）
  alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environment, appName, alertEmail } = props;

    // SNSトピック - アラート通知用
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${appName}-alarms-${environment}`,
      displayName: 'Meeting Minutes Generator Alarms',
    });

    // メールアドレスが指定されている場合はサブスクリプションを追加
    if (alertEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // CloudWatchダッシュボード
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${appName}-${environment}`,
    });

    // Lambda関数のメトリクスとアラームを設定
    this.setupLambdaMonitoring(props);

    // API Gatewayのメトリクスとアラームを設定
    this.setupApiGatewayMonitoring(props);

    // Step Functionsのメトリクスとアラームを設定
    this.setupStepFunctionsMonitoring(props);

    // システム全体のメトリクスを設定
    this.setupSystemMetrics(props);

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${appName}-dashboard-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: `${appName}-alarm-topic-arn-${environment}`,
    });

    // Add stack-specific tags
    cdk.Tags.of(this).add('Stack', 'Monitoring');
    cdk.Tags.of(this).add('Component', 'Observability');
  }

  /**
   * Lambda関数のモニタリングを設定
   */
  private setupLambdaMonitoring(props: MonitoringStackProps): void {
    const { appName, environment } = props;
    const lambdaFunctions = [
      { name: 'Upload Handler', func: props.uploadHandler },
      { name: 'Transcribe Trigger', func: props.transcribeTrigger },
      { name: 'Check Transcribe Status', func: props.checkTranscribeStatus },
      { name: 'Minutes Generator', func: props.minutesGeneratorHandler },
      { name: 'Get Job Status', func: props.getJobStatusHandler },
      { name: 'List Jobs', func: props.listJobsHandler },
      { name: 'Get Minutes', func: props.getMinutesHandler },
      { name: 'Download Minutes', func: props.downloadMinutesHandler },
      { name: 'Start Processing', func: props.startProcessingHandler },
    ];

    // Lambda関数ごとのメトリクスウィジェット
    const lambdaErrorWidgets: cloudwatch.IWidget[] = [];
    const lambdaDurationWidgets: cloudwatch.IWidget[] = [];
    const lambdaInvocationWidgets: cloudwatch.IWidget[] = [];

    lambdaFunctions.forEach(({ name, func }) => {
      // エラー率のメトリクス
      const errorMetric = func.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // 実行時間のメトリクス
      const durationMetric = func.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // 呼び出し回数のメトリクス
      const invocationMetric = func.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // スロットリングのメトリクス
      const throttleMetric = func.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // エラー率アラーム（5分間で5回以上のエラー）
      const errorAlarm = new cloudwatch.Alarm(this, `${name.replace(/\s+/g, '')}ErrorAlarm`, {
        alarmName: `${appName}-${name.toLowerCase().replace(/\s+/g, '-')}-errors-${environment}`,
        metric: errorMetric,
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${name} Lambda関数のエラー率が高くなっています`,
      });
      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // レイテンシアラーム（平均実行時間が30秒を超える）
      const durationAlarm = new cloudwatch.Alarm(this, `${name.replace(/\s+/g, '')}DurationAlarm`, {
        alarmName: `${appName}-${name.toLowerCase().replace(/\s+/g, '-')}-duration-${environment}`,
        metric: durationMetric,
        threshold: 30000, // 30秒（ミリ秒）
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${name} Lambda関数の実行時間が長くなっています`,
      });
      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // スロットリングアラーム
      const throttleAlarm = new cloudwatch.Alarm(this, `${name.replace(/\s+/g, '')}ThrottleAlarm`, {
        alarmName: `${appName}-${name.toLowerCase().replace(/\s+/g, '-')}-throttles-${environment}`,
        metric: throttleMetric,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${name} Lambda関数がスロットリングされています`,
      });
      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // ウィジェットを作成
      lambdaErrorWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${name} - Errors`,
          left: [errorMetric],
          width: 8,
          height: 6,
        })
      );

      lambdaDurationWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${name} - Duration`,
          left: [durationMetric],
          width: 8,
          height: 6,
        })
      );

      lambdaInvocationWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${name} - Invocations`,
          left: [invocationMetric, throttleMetric],
          width: 8,
          height: 6,
        })
      );
    });

    // ダッシュボードにLambdaメトリクスを追加
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lambda Functions - Errors',
        width: 24,
        height: 1,
      })
    );
    lambdaErrorWidgets.forEach((widget) => this.dashboard.addWidgets(widget));

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lambda Functions - Duration',
        width: 24,
        height: 1,
      })
    );
    lambdaDurationWidgets.forEach((widget) => this.dashboard.addWidgets(widget));

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Lambda Functions - Invocations',
        width: 24,
        height: 1,
      })
    );
    lambdaInvocationWidgets.forEach((widget) => this.dashboard.addWidgets(widget));
  }

  /**
   * API Gatewayのモニタリングを設定
   */
  private setupApiGatewayMonitoring(props: MonitoringStackProps): void {
    const { appName, environment, api } = props;

    // API Gatewayのメトリクス
    const apiRequestsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api4xxErrorsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api5xxErrorsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // API Gateway 5xxエラーアラーム
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxErrorAlarm', {
      alarmName: `${appName}-api-5xx-errors-${environment}`,
      metric: api5xxErrorsMetric,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gatewayで5xxエラーが多発しています',
    });
    api5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // API Gatewayレイテンシアラーム（平均レイテンシが5秒を超える）
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${appName}-api-latency-${environment}`,
      metric: apiLatencyMetric,
      threshold: 5000, // 5秒（ミリ秒）
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gatewayのレイテンシが高くなっています',
    });
    apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // ダッシュボードにAPI Gatewayメトリクスを追加
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# API Gateway',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Requests',
        left: [apiRequestsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [api4xxErrorsMetric, api5xxErrorsMetric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [apiLatencyMetric],
        width: 24,
        height: 6,
      })
    );
  }

  /**
   * Step Functionsのモニタリングを設定
   */
  private setupStepFunctionsMonitoring(props: MonitoringStackProps): void {
    const { appName, environment, stateMachine } = props;

    // Step Functionsのメトリクス
    const executionsStartedMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsStarted',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const executionsSucceededMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsSucceeded',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const executionsFailedMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsFailed',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const executionsTimedOutMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsTimedOut',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const executionTimeMetric = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionTime',
      dimensionsMap: {
        StateMachineArn: stateMachine.stateMachineArn,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Step Functions失敗アラーム
    const executionsFailedAlarm = new cloudwatch.Alarm(this, 'StepFunctionsFailedAlarm', {
      alarmName: `${appName}-stepfunctions-failed-${environment}`,
      metric: executionsFailedMetric,
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Step Functionsワークフローの失敗が多発しています',
    });
    executionsFailedAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Step Functionsタイムアウトアラーム
    const executionsTimedOutAlarm = new cloudwatch.Alarm(this, 'StepFunctionsTimedOutAlarm', {
      alarmName: `${appName}-stepfunctions-timeout-${environment}`,
      metric: executionsTimedOutMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Step Functionsワークフローがタイムアウトしています',
    });
    executionsTimedOutAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // ダッシュボードにStep Functionsメトリクスを追加
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# Step Functions Workflow',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Workflow Executions',
        left: [executionsStartedMetric, executionsSucceededMetric, executionsFailedMetric, executionsTimedOutMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Workflow Execution Time',
        left: [executionTimeMetric],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * システム全体のメトリクスを設定
   */
  private setupSystemMetrics(props: MonitoringStackProps): void {
    const { appName, environment } = props;

    // カスタムメトリクス用のネームスペース
    const namespace = `${appName}/${environment}`;

    // 処理成功率のメトリクス（カスタムメトリクス）
    const successRateMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'ProcessingSuccessRate',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // 平均処理時間のメトリクス（カスタムメトリクス）
    const avgProcessingTimeMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'AverageProcessingTime',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // アクティブジョブ数のメトリクス（カスタムメトリクス）
    const activeJobsMetric = new cloudwatch.Metric({
      namespace,
      metricName: 'ActiveJobs',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // ダッシュボードにシステムメトリクスを追加
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# System Metrics',
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Processing Success Rate',
        left: [successRateMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Average Processing Time',
        left: [avgProcessingTimeMetric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Active Jobs',
        left: [activeJobsMetric],
        width: 24,
        height: 6,
      })
    );

    // システム全体の成功率アラーム（80%を下回る）
    const successRateAlarm = new cloudwatch.Alarm(this, 'SystemSuccessRateAlarm', {
      alarmName: `${appName}-success-rate-${environment}`,
      metric: successRateMetric,
      threshold: 0.8, // 80%
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'システム全体の処理成功率が低下しています',
    });
    successRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
}
