# Architecture Documentation

## Overview

The Meeting Minutes Generator is a serverless application built on AWS that automatically converts MP4 meeting recordings into structured meeting minutes using AI.

## System Architecture

### High-Level Components

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend (Next.js)                         │
│  - File Upload UI                                       │
│  - Job Status Tracking                                  │
│  - Minutes Display & Editing                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│         API Gateway + Lambda Functions                  │
│  - Upload Handler                                       │
│  - Status Checker                                       │
│  - Download Handler                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│    S3    │    │ DynamoDB │    │   Step   │
│ Buckets  │    │  Table   │    │Functions │
└──────────┘    └──────────┘    └────┬─────┘
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                ┌──────────┐   ┌──────────┐   ┌──────────┐
                │   AWS    │   │  Amazon  │   │ Lambda   │
                │Transcribe│   │ Bedrock  │   │Functions │
                └──────────┘   └──────────┘   └──────────┘
```

## Infrastructure Components

### Storage Layer

#### S3 Buckets

**Input Bucket**
- Purpose: Store uploaded MP4 video files
- Encryption: S3-managed (SSE-S3)
- Lifecycle: Delete after 30 days
- CORS: Enabled for direct upload from browser
- Access: Private with presigned URLs

**Output Bucket**
- Purpose: Store transcripts and generated minutes
- Encryption: S3-managed (SSE-S3)
- Versioning: Enabled
- Lifecycle: Transition to IA after 90 days
- Access: Private with presigned URLs for download

#### DynamoDB Table

**MeetingJobs Table**
- Partition Key: `jobId` (String)
- Sort Key: `userId` (String)
- Billing: On-demand (pay per request)
- Encryption: AWS-managed
- GSI: `userId-createdAt-index` for user job queries

**Schema**:
```typescript
{
  jobId: string;           // UUID
  userId: string;          // User identifier
  status: string;          // Job status
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  videoFileName: string;
  videoS3Key: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;
  errorMessage?: string;
  metadata?: object;
}
```

### Compute Layer

#### IAM Roles

**Lambda Execution Role**
- Permissions:
  - CloudWatch Logs (write)
  - S3 (read/write on both buckets)
  - DynamoDB (read/write on jobs table)
  - Transcribe (start/get jobs)
  - Bedrock (invoke models)

**Transcribe Role**
- Permissions:
  - S3 (read from input bucket)
  - S3 (write to output bucket)

**Step Functions Role**
- Permissions:
  - Lambda (invoke functions)
  - CloudWatch Logs (write)

### Processing Pipeline

#### Step 1: File Upload
1. User selects MP4 file in frontend
2. Frontend requests presigned URL from API
3. Lambda generates presigned URL for S3
4. Frontend uploads directly to S3
5. Lambda creates job record in DynamoDB
6. Lambda triggers Step Functions workflow

#### Step 2: Transcription
1. Step Functions invokes Transcribe Lambda
2. Lambda starts AWS Transcribe job
3. Transcribe processes audio with speaker diarization
4. Step Functions polls for completion
5. Transcribe writes JSON output to S3

#### Step 3: Minutes Generation
1. Step Functions invokes Minutes Generator Lambda
2. Lambda retrieves transcript from S3
3. Lambda calls Amazon Bedrock (Claude/GPT)
4. LLM generates structured minutes
5. Lambda saves minutes to S3
6. Lambda updates job status in DynamoDB

#### Step 4: Retrieval
1. User requests minutes via frontend
2. API Gateway routes to Download Lambda
3. Lambda retrieves minutes from S3
4. Lambda generates presigned URL
5. User downloads or views minutes

## Data Flow

### Upload Flow
```
User → Frontend → API Gateway → Upload Lambda → S3
                                      ↓
                                  DynamoDB
                                      ↓
                              Step Functions
```

### Processing Flow
```
Step Functions → Transcribe Lambda → AWS Transcribe → S3
                                                        ↓
Step Functions → Minutes Lambda → Bedrock → S3
                        ↓
                    DynamoDB
```

### Download Flow
```
User → Frontend → API Gateway → Download Lambda → S3
                                      ↓
                                Presigned URL
                                      ↓
                                    User
```

## Security Architecture

### Authentication & Authorization
- Amazon Cognito for user authentication (optional)
- JWT tokens for API authentication
- IAM roles for service-to-service auth

### Data Protection
- **In Transit**: TLS 1.2+ for all connections
- **At Rest**: S3 SSE-S3 encryption, DynamoDB AWS-managed encryption
- **Access Control**: IAM policies, S3 bucket policies

### Network Security
- S3 buckets: Block all public access
- API Gateway: CORS configured for frontend domain
- Lambda: VPC optional (not required for this architecture)

## Scalability

### Horizontal Scaling
- Lambda: Automatic scaling up to account limits
- DynamoDB: On-demand scaling
- S3: Unlimited storage
- API Gateway: Handles millions of requests

### Performance Optimization
- S3 presigned URLs: Direct upload/download (no Lambda proxy)
- DynamoDB GSI: Fast user queries
- Lambda: Optimized memory allocation
- CloudFront: CDN for frontend (optional)

## Monitoring & Observability

### CloudWatch Logs
- All Lambda functions log to CloudWatch
- Step Functions execution logs
- API Gateway access logs

### CloudWatch Metrics
- Lambda invocations, duration, errors
- DynamoDB read/write capacity
- S3 request metrics
- Custom metrics: processing time, success rate

### X-Ray (Optional)
- Distributed tracing across services
- Performance bottleneck identification
- Error analysis

## Cost Optimization

### Storage
- S3 lifecycle policies: Move old files to cheaper storage
- DynamoDB on-demand: Pay only for actual usage
- CloudWatch log retention: 7-30 days

### Compute
- Lambda: Right-sized memory allocation
- Step Functions: Efficient workflow design
- Transcribe: Only process when needed

### Data Transfer
- S3 presigned URLs: Reduce Lambda data transfer
- CloudFront: Cache static assets (frontend)

## Disaster Recovery

### Backup Strategy
- S3: Versioning enabled on output bucket
- DynamoDB: Point-in-time recovery (production)
- CloudFormation: Infrastructure as code

### Recovery Procedures
1. Redeploy infrastructure from CDK code
2. Restore DynamoDB from backup (if needed)
3. S3 data persists (retained on stack deletion in prod)

## Future Enhancements

### Phase 2
- Real-time transcription for live meetings
- Multi-language support
- Custom minutes templates
- Integration with calendar systems

### Phase 3
- Collaborative editing
- Action item tracking
- Integration with project management tools
- Advanced analytics and insights

## Technology Stack

### Infrastructure
- AWS CDK (TypeScript)
- CloudFormation

### Backend
- Node.js 18+
- TypeScript
- AWS Lambda
- AWS Step Functions

### Storage
- Amazon S3
- Amazon DynamoDB

### AI/ML
- AWS Transcribe
- Amazon Bedrock (Claude 3)

### Frontend
- Next.js 14
- React
- TypeScript
- TailwindCSS

### DevOps
- GitHub Actions / AWS CodePipeline
- Jest (testing)
- ESLint (linting)

## Development Workflow

1. **Local Development**
   - Edit infrastructure code
   - Run tests: `npm test`
   - Build: `npm run build`

2. **Preview Changes**
   - Synthesize: `cdk synth`
   - Diff: `cdk diff`

3. **Deploy**
   - Deploy to dev: `cdk deploy --all`
   - Test in dev environment
   - Deploy to staging/prod

4. **Monitor**
   - Check CloudWatch logs
   - Review metrics
   - Analyze costs

## Compliance & Best Practices

### AWS Well-Architected Framework

**Operational Excellence**
- Infrastructure as Code (CDK)
- Automated deployments
- Comprehensive logging

**Security**
- Encryption at rest and in transit
- Least privilege IAM policies
- No hardcoded credentials

**Reliability**
- Serverless architecture (no servers to manage)
- Automatic retries in Step Functions
- Error handling in all Lambda functions

**Performance Efficiency**
- Right-sized Lambda functions
- DynamoDB on-demand scaling
- S3 for efficient storage

**Cost Optimization**
- Pay-per-use pricing model
- Lifecycle policies for storage
- Resource tagging for cost allocation

**Sustainability**
- Serverless reduces idle resources
- Efficient data processing
- Optimized storage usage
