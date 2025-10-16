import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  apiUrl?: string;
}

/**
 * フロントエンドホスティングスタック
 * Next.jsアプリケーションをS3 + CloudFrontでホスティング
 */
export class FrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly bucket: s3.Bucket;
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // S3バケット（フロントエンドのホスティング用）
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${props.appName}-frontend-${props.environment}-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false, // CloudFront経由でのみアクセス可能
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: props.environment === 'prod',
      lifecycleRules: props.environment === 'prod' ? [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ] : undefined,
    });

    // CloudFront Origin Access Identity（OAI）の代わりにOrigin Access Control（OAC）を使用
    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: `${props.appName}-oac-${props.environment}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
        description: 'Origin Access Control for Frontend S3 Bucket',
      },
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${props.appName} Frontend Distribution (${props.environment})`,
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // 北米・ヨーロッパのみ（コスト削減）
      enableLogging: props.environment === 'prod',
      logBucket: props.environment === 'prod' ? new s3.Bucket(this, 'LogBucket', {
        bucketName: `${props.appName}-cf-logs-${props.environment}-${this.account}`,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        encryption: s3.BucketEncryption.S3_MANAGED,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(90),
          },
        ],
      }) : undefined,
    });

    // OACをCloudFront Distributionに関連付け
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      originAccessControl.attrId
    );
    // OAIを削除（OACを使用するため）
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      ''
    );

    // S3バケットポリシー（CloudFrontからのアクセスを許可）
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [this.bucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
          },
        },
      })
    );

    // フロントエンドのデプロイ（Next.js静的エクスポート）
    // 注: Next.jsアプリケーションは事前にビルドしておく必要があります
    // npm run build を実行してから cdk deploy を実行してください
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset('./frontend/out')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true, // 古いファイルを削除
      memoryLimit: 512,
    });

    // CloudFrontのドメイン名を保存
    this.distributionDomainName = this.distribution.distributionDomainName;

    // Outputs
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.bucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: `${props.appName}-frontend-bucket-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${props.appName}-distribution-id-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `${props.appName}-distribution-domain-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${this.distributionDomainName}`,
      description: 'Frontend URL',
      exportName: `${props.appName}-frontend-url-${props.environment}`,
    });

    // タグの追加
    cdk.Tags.of(this).add('Component', 'Frontend');
  }
}
