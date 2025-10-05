/**
 * Meeting Job Repository
 * Handles all DynamoDB operations for MeetingJob entities
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    QueryCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
    MeetingJob,
    CreateMeetingJobInput,
    UpdateMeetingJobInput,
    ListJobsQuery,
    ListJobsResult,
    JobStatus,
} from '../models/meeting-job';
import { Logger } from '../utils/logger';
import { InternalServerError, NotFoundError } from '../utils/errors';

export class MeetingJobRepository {
    private readonly docClient: DynamoDBDocumentClient;
    private readonly tableName: string;
    private readonly logger: Logger;

    constructor(tableName: string, region?: string) {
        const client = new DynamoDBClient({ region: region || process.env.AWS_REGION });
        this.docClient = DynamoDBDocumentClient.from(client, {
            marshallOptions: {
                removeUndefinedValues: true,
                convertEmptyValues: false,
            },
        });
        this.tableName = tableName;
        this.logger = new Logger({ component: 'MeetingJobRepository' });
    }

    /**
     * Create a new meeting job
     */
    async createJob(input: CreateMeetingJobInput): Promise<MeetingJob> {
        const now = new Date().toISOString();
        const jobId = uuidv4();

        const job: MeetingJob = {
            jobId,
            userId: input.userId,
            status: 'UPLOADED',
            createdAt: now,
            updatedAt: now,
            videoFileName: input.videoFileName,
            videoS3Key: input.videoS3Key,
            videoSize: input.videoSize,
            metadata: input.metadata,
        };

        try {
            await this.docClient.send(
                new PutCommand({
                    TableName: this.tableName,
                    Item: job,
                })
            );

            this.logger.info('Created job', { jobId, userId: input.userId });
            return job;
        } catch (error) {
            this.logger.error('Error creating job', error as Error, { userId: input.userId });
            throw new InternalServerError(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get a job by jobId and userId
     */
    async getJob(jobId: string, userId: string): Promise<MeetingJob | null> {
        try {
            const result = await this.docClient.send(
                new GetCommand({
                    TableName: this.tableName,
                    Key: {
                        jobId,
                        userId,
                    },
                })
            );

            if (!result.Item) {
                this.logger.info('Job not found', { jobId, userId });
                return null;
            }

            this.logger.info('Retrieved job', { jobId, userId });
            return result.Item as MeetingJob;
        } catch (error) {
            this.logger.error('Error getting job', error as Error, { jobId, userId });
            throw new InternalServerError(`Failed to get job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update a job's status and other fields
     */
    async updateJob(input: UpdateMeetingJobInput): Promise<MeetingJob> {
        const now = new Date().toISOString();

        // Build update expression dynamically
        const updateExpressions: string[] = ['updatedAt = :updatedAt'];
        const expressionAttributeValues: Record<string, any> = {
            ':updatedAt': now,
        };
        const expressionAttributeNames: Record<string, string> = {};

        if (input.status !== undefined) {
            updateExpressions.push('#status = :status');
            expressionAttributeValues[':status'] = input.status;
            expressionAttributeNames['#status'] = 'status';
        }

        if (input.videoDuration !== undefined) {
            updateExpressions.push('videoDuration = :videoDuration');
            expressionAttributeValues[':videoDuration'] = input.videoDuration;
        }

        if (input.transcribeJobName !== undefined) {
            updateExpressions.push('transcribeJobName = :transcribeJobName');
            expressionAttributeValues[':transcribeJobName'] = input.transcribeJobName;
        }

        if (input.transcriptS3Key !== undefined) {
            updateExpressions.push('transcriptS3Key = :transcriptS3Key');
            expressionAttributeValues[':transcriptS3Key'] = input.transcriptS3Key;
        }

        if (input.minutesS3Key !== undefined) {
            updateExpressions.push('minutesS3Key = :minutesS3Key');
            expressionAttributeValues[':minutesS3Key'] = input.minutesS3Key;
        }

        if (input.errorMessage !== undefined) {
            updateExpressions.push('errorMessage = :errorMessage');
            expressionAttributeValues[':errorMessage'] = input.errorMessage;
        }

        if (input.metadata !== undefined) {
            updateExpressions.push('metadata = :metadata');
            expressionAttributeValues[':metadata'] = input.metadata;
        }

        try {
            const result = await this.docClient.send(
                new UpdateCommand({
                    TableName: this.tableName,
                    Key: {
                        jobId: input.jobId,
                        userId: input.userId,
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ...(Object.keys(expressionAttributeNames).length > 0 && {
                        ExpressionAttributeNames: expressionAttributeNames,
                    }),
                    ReturnValues: 'ALL_NEW',
                })
            );

            this.logger.info('Updated job', {
                jobId: input.jobId,
                userId: input.userId,
                status: input.status || 'unchanged'
            });
            return result.Attributes as MeetingJob;
        } catch (error) {
            this.logger.error('Error updating job', error as Error, {
                jobId: input.jobId,
                userId: input.userId
            });
            throw new InternalServerError(`Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update job status
     */
    async updateJobStatus(
        jobId: string,
        userId: string,
        status: JobStatus,
        errorMessage?: string
    ): Promise<MeetingJob> {
        return this.updateJob({
            jobId,
            userId,
            status,
            errorMessage,
        });
    }

    /**
     * List jobs for a user using GSI
     */
    async listJobsByUser(query: ListJobsQuery): Promise<ListJobsResult> {
        try {
            const result = await this.docClient.send(
                new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'userId-createdAt-index',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': query.userId,
                    },
                    ScanIndexForward: false, // Sort by createdAt descending (newest first)
                    Limit: query.limit || 50,
                    ...(query.lastEvaluatedKey && {
                        ExclusiveStartKey: query.lastEvaluatedKey,
                    }),
                })
            );

            this.logger.info('Listed jobs', {
                userId: query.userId,
                count: result.Items?.length || 0
            });

            return {
                jobs: (result.Items || []) as MeetingJob[],
                lastEvaluatedKey: result.LastEvaluatedKey,
            };
        } catch (error) {
            this.logger.error('Error listing jobs', error as Error, { userId: query.userId });
            throw new InternalServerError(`Failed to list jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete a job
     */
    async deleteJob(jobId: string, userId: string): Promise<void> {
        try {
            await this.docClient.send(
                new DeleteCommand({
                    TableName: this.tableName,
                    Key: {
                        jobId,
                        userId,
                    },
                })
            );

            this.logger.info('Deleted job', { jobId, userId });
        } catch (error) {
            this.logger.error('Error deleting job', error as Error, { jobId, userId });
            throw new InternalServerError(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
