# Deployment Guide

This guide walks you through deploying the Meeting Minutes Generator infrastructure to AWS.

## Prerequisites

1. **AWS Account**: You need an AWS account with appropriate permissions
2. **AWS CLI**: Install and configure AWS CLI with your credentials
   ```bash
   aws configure
   ```
3. **Node.js**: Version 18 or higher
4. **AWS CDK**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

## Initial Setup

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
copy .env.example .env
```

Edit `.env` and set your values:

```env
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
ENVIRONMENT=dev
APP_NAME=meeting-minutes-generator
```

### 3. Bootstrap CDK (First Time Only)

Bootstrap CDK in your AWS account and region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` and `REGION` with your values.

## Deployment Steps

### 1. Build the Project

```bash
npm run build
```

### 2. Review Changes (Optional)

See what will be deployed:

```bash
cdk diff
```

### 3. Deploy Infrastructure

Deploy all stacks:

```bash
cdk deploy --all
```

Or deploy stacks individually:

```bash
# Deploy storage resources first
cdk deploy meeting-minutes-generator-storage-dev

# Then deploy compute resources
cdk deploy meeting-minutes-generator-compute-dev
```

### 4. Note the Outputs

After deployment, CDK will output important values:

```
Outputs:
meeting-minutes-generator-storage-dev.InputBucketName = meeting-minutes-generator-input-dev-123456789012
meeting-minutes-generator-storage-dev.OutputBucketName = meeting-minutes-generator-output-dev-123456789012
meeting-minutes-generator-storage-dev.JobsTableName = meeting-minutes-generator-jobs-dev
meeting-minutes-generator-compute-dev.LambdaExecutionRoleArn = arn:aws:iam::...
```

Save these values for configuring Lambda functions and the frontend.

## Environment-Specific Deployments

### Development

```bash
ENVIRONMENT=dev cdk deploy --all
```

### Staging

```bash
ENVIRONMENT=staging cdk deploy --all
```

### Production

```bash
ENVIRONMENT=prod cdk deploy --all
```

**Note**: Production deployments have additional safeguards:
- S3 buckets are retained on stack deletion
- DynamoDB has point-in-time recovery enabled
- Resources are not auto-deleted

## Verification

### 1. Check S3 Buckets

```bash
aws s3 ls | grep meeting-minutes
```

### 2. Check DynamoDB Table

```bash
aws dynamodb describe-table --table-name meeting-minutes-generator-jobs-dev
```

### 3. Check IAM Roles

```bash
aws iam list-roles | grep meeting-minutes
```

## Updating Infrastructure

When you make changes to the infrastructure code:

1. Build the project:
   ```bash
   npm run build
   ```

2. Review changes:
   ```bash
   cdk diff
   ```

3. Deploy updates:
   ```bash
   cdk deploy --all
   ```

## Rollback

If you need to rollback a deployment:

1. Revert your code changes
2. Rebuild and redeploy:
   ```bash
   npm run build
   cdk deploy --all
   ```

## Cleanup

To remove all deployed resources:

```bash
cdk destroy --all
```

**Warning**: This will delete:
- All S3 buckets and their contents (in dev/staging)
- DynamoDB tables and data (in dev/staging)
- IAM roles and policies
- CloudWatch logs

Production resources are retained by default for safety.

## Troubleshooting

### CDK Bootstrap Issues

If you get bootstrap errors:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION --force
```

### Permission Errors

Ensure your AWS credentials have these permissions:
- CloudFormation (full access)
- S3 (create/delete buckets)
- DynamoDB (create/delete tables)
- IAM (create/delete roles and policies)
- Lambda (create/update functions)

### Stack Deletion Failures

If a stack fails to delete due to non-empty S3 buckets:

```bash
# Empty the buckets first
aws s3 rm s3://bucket-name --recursive

# Then retry deletion
cdk destroy
```

## Cost Estimation

Estimated monthly costs for different usage levels:

### Low Usage (10 jobs/month)
- S3: ~$1
- DynamoDB: ~$1
- Lambda: ~$1
- Transcribe: ~$6
- Bedrock: ~$2
- **Total**: ~$11/month

### Medium Usage (100 jobs/month)
- S3: ~$5
- DynamoDB: ~$5
- Lambda: ~$10
- Transcribe: ~$60
- Bedrock: ~$20
- **Total**: ~$100/month

### High Usage (1000 jobs/month)
- S3: ~$50
- DynamoDB: ~$50
- Lambda: ~$100
- Transcribe: ~$600
- Bedrock: ~$200
- **Total**: ~$1000/month

## Monitoring

After deployment, monitor your resources:

1. **CloudWatch Dashboard**: View metrics and logs
2. **Cost Explorer**: Track spending
3. **CloudTrail**: Audit API calls

## Next Steps

After infrastructure deployment:

1. Deploy Lambda functions (Tasks 2-8)
2. Create Step Functions workflow (Task 5)
3. Deploy frontend application (Tasks 9-13)
4. Set up monitoring and alerts (Task 19)
5. Configure CI/CD pipeline (Task 18)

## Support

For issues or questions:
- Check CloudWatch Logs for error messages
- Review CloudFormation events in AWS Console
- Verify IAM permissions
- Ensure all environment variables are set correctly
