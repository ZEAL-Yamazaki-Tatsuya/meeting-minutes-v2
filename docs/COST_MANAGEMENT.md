# Cost Management Guide

## Overview

This document explains how to monitor and manage costs for the Meeting Minutes Generator application.

## Resource Tagging Strategy

All AWS resources are tagged with the following tags for cost tracking:

### Global Tags (Applied to all resources)
- **Application**: `meeting-minutes-generator`
- **Environment**: `dev` / `prod`
- **ManagedBy**: `CDK`
- **Project**: `meeting-minutes-generator`
- **CostCenter**: `Development`
- **Owner**: Email address from `OWNER_EMAIL` env variable

### Stack-Specific Tags
- **Stack**: `Storage` / `Auth` / `Compute` / `Frontend`
- **Component**: `Backend` / `Frontend` / `Security`
- **Service**: Service name (e.g., `Amplify`, `Lambda`, `S3`)

## Cost Monitoring

### 1. Quick Cost Check

Check current month's costs:

```powershell
.\scripts\check-costs.ps1
```

### 2. Cost by Tags

Check costs filtered by application tags:

```powershell
.\scripts\check-costs-by-tags.ps1
```

### 3. All Services Report

View detailed breakdown of all services:

```powershell
.\scripts\check-all-services.ps1
```

## Enable Cost Allocation Tags

To use tag-based cost filtering, you must activate Cost Allocation Tags:

1. Go to [AWS Billing - Cost Allocation Tags](https://console.aws.amazon.com/billing/home#/tags)
2. Activate these tags:
   - `Application`
   - `Environment`
   - `Stack`
   - `Component`
   - `Project`
   - `CostCenter`
   - `Owner`
3. Wait 24 hours for cost data to appear

## Set Up Budget Alerts

Create a monthly budget with email notifications:

```powershell
.\scripts\setup-budget-alert.ps1 -MonthlyBudget 10 -EmailAddress "your-email@example.com"
```

This will send notifications when:
- Actual cost exceeds 80% of budget
- Forecasted cost exceeds 100% of budget

## Cost Explorer

For detailed analysis, use AWS Cost Explorer:
- URL: https://console.aws.amazon.com/cost-management/home#/cost-explorer

### Recommended Filters
- **Service**: Filter by specific AWS services
- **Tag**: Filter by Application, Environment, Stack
- **Time Range**: Daily, Monthly, Custom

### Useful Reports
1. **Cost by Service**: Identify which services cost the most
2. **Cost by Tag**: Track costs by Stack or Environment
3. **Daily Costs**: Monitor spending trends
4. **Forecast**: Predict end-of-month costs

## Expected Costs

### Free Tier Services (First 12 months)
- **Lambda**: 1M requests/month, 400,000 GB-seconds
- **API Gateway**: 1M requests/month
- **S3**: 5GB storage, 20,000 GET requests, 2,000 PUT requests
- **DynamoDB**: 25GB storage, 25 read/write capacity units
- **Cognito**: 50,000 MAU (Monthly Active Users)
- **Amplify**: 1,000 build minutes, 5GB storage

### Always Free Services
- **Lambda**: 1M requests/month, 400,000 GB-seconds
- **DynamoDB**: 25GB storage, 25 read/write capacity units
- **Cognito**: 50,000 MAU
- **Step Functions**: 4,000 state transitions/month

### Pay-As-You-Go Services (No Free Tier)

#### Amazon Bedrock (Claude 3.5 Sonnet v2)
- **Input**: $3.00 per 1M tokens
- **Output**: $15.00 per 1M tokens
- **Example**: 10-minute meeting (~3,000 tokens) = $0.05-0.10

#### Amazon Transcribe
- **Standard**: $0.024 per minute (after 60 free minutes/month for first 12 months)
- **Example**: 1-hour meeting = $1.44

## Cost Optimization Tips

### 1. Use Lifecycle Policies
- Input videos are automatically deleted after 7 days
- Output documents are automatically deleted after 90 days

### 2. Monitor Bedrock Usage
Bedrock is the most expensive service. To reduce costs:
- Use shorter prompts
- Optimize the minutes generation prompt
- Consider using a smaller model for testing

### 3. Clean Up Unused Resources
Regularly check for:
- Old S3 objects
- Unused DynamoDB items
- Failed transcription jobs

### 4. Use Development Environment Wisely
- Delete dev resources when not in use
- Use smaller test files during development
- Limit the number of test runs

## Cost Breakdown by Service

### High Cost Services (Pay attention to these)
1. **Amazon Bedrock**: $3-15 per 1M tokens
2. **Amazon Transcribe**: $0.024 per minute

### Medium Cost Services
3. **AWS Amplify**: Build minutes and bandwidth
4. **Amazon S3**: Storage and data transfer
5. **AWS Lambda**: Execution time beyond free tier

### Low/No Cost Services
6. **Amazon DynamoDB**: Usually within free tier
7. **Amazon API Gateway**: Usually within free tier
8. **Amazon Cognito**: Usually within free tier
9. **AWS Step Functions**: Usually within free tier
10. **Amazon CloudWatch**: Logs and metrics

## Monitoring Best Practices

1. **Check costs weekly**: Run `.\scripts\check-costs.ps1` every week
2. **Set up budget alerts**: Get notified before overspending
3. **Review Cost Explorer monthly**: Identify trends and anomalies
4. **Tag all resources**: Ensure proper cost allocation
5. **Clean up regularly**: Delete unused resources

## Troubleshooting

### Tags not showing in Cost Explorer
- Wait 24-48 hours after activating Cost Allocation Tags
- Ensure tags are properly applied to resources
- Check that resources were created after tag activation

### Costs higher than expected
1. Check Bedrock usage (most expensive)
2. Check Transcribe usage
3. Review S3 storage and data transfer
4. Check for failed jobs that retry multiple times

### No cost data available
- Cost data has a 24-hour delay
- Ensure you're looking at the correct time period
- Check that resources are actually being used

## Additional Resources

- [AWS Cost Management](https://aws.amazon.com/aws-cost-management/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)
