# Meeting Minutes Generator

Automated meeting minutes generator from MP4 files using AWS services.

## Architecture

This application uses a serverless architecture on AWS:

- **Frontend**: Next.js 14 (React) with TypeScript
- **Backend**: AWS Lambda functions
- **Storage**: S3 (videos and documents), DynamoDB (job metadata)
- **Processing**: AWS Transcribe (speech-to-text), Amazon Bedrock (LLM for minutes generation)
- **Orchestration**: AWS Step Functions
- **API**: API Gateway

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- An AWS account with permissions to create resources

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and update with your values:

```bash
copy .env.example .env
```

Edit `.env` and set:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: Your preferred AWS region (e.g., us-east-1)
- `ENVIRONMENT`: Environment name (dev, staging, prod)
- Other configuration values as needed

### 3. Bootstrap CDK (First Time Only)

If this is your first time using CDK in this AWS account/region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 4. Build the Project

```bash
npm run build
```

### 5. Deploy Infrastructure

Deploy all stacks:

```bash
npm run deploy
```

Or deploy specific stacks:

```bash
cdk deploy meeting-minutes-generator-storage-dev
cdk deploy meeting-minutes-generator-compute-dev
```

## Project Structure

```
.
├── bin/
│   └── meeting-minutes-app.ts      # CDK app entry point
├── lib/
│   ├── storage-stack.ts            # S3 and DynamoDB resources
│   ├── compute-stack.ts            # Lambda and IAM roles
│   └── config.ts                   # Configuration management
├── lambda/                         # Lambda function code (to be added)
├── frontend/                       # Next.js frontend (to be added)
├── test/                          # Test files
├── cdk.json                       # CDK configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies
└── .env                          # Environment variables (not in git)
```

## Available Scripts

- `npm run build` - Compile TypeScript
- `npm run watch` - Watch mode for development
- `npm test` - Run tests
- `npm run cdk` - Run CDK CLI commands
- `npm run deploy` - Deploy all stacks
- `npm run synth` - Synthesize CloudFormation templates

## CDK Stacks

### Storage Stack

Creates:
- S3 bucket for input videos (with lifecycle rules)
- S3 bucket for output documents (with versioning)
- DynamoDB table for job metadata (with GSI)

### Compute Stack

Creates:
- IAM roles for Lambda functions
- IAM role for AWS Transcribe
- IAM role for Step Functions
- Permissions for Bedrock access

## Development Workflow

1. Make changes to infrastructure code in `lib/`
2. Build: `npm run build`
3. Review changes: `cdk diff`
4. Deploy: `cdk deploy`

## Testing

Run unit tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test -- --watch
```

## Cleanup

To remove all deployed resources:

```bash
cdk destroy --all
```

**Warning**: This will delete all resources including S3 buckets and DynamoDB tables (if not in production).

## Security

- All S3 buckets use server-side encryption
- S3 buckets block all public access
- DynamoDB uses AWS-managed encryption
- IAM roles follow least privilege principle
- CORS is configured for frontend access

## Cost Optimization

- S3 lifecycle rules move old files to cheaper storage
- DynamoDB uses on-demand billing
- Lambda functions are serverless (pay per use)
- CloudWatch logs have retention policies

## Next Steps

1. Implement Lambda functions (Task 2-8)
2. Create Step Functions workflow (Task 5)
3. Build frontend application (Task 9-13)
4. Add authentication (Task 14)
5. Set up monitoring and alerts (Task 19)
6. Create deployment pipeline (Task 18)

## License

MIT
