/**
 * Unit tests for MeetingJobRepository
 */

import { MeetingJobRepository } from '../meeting-job-repository';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { CreateMeetingJobInput, JobStatus } from '../../models/meeting-job';

// Mock the DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('MeetingJobRepository', () => {
  let repository: MeetingJobRepository;
  const tableName = 'test-jobs-table';

  beforeEach(() => {
    ddbMock.reset();
    repository = new MeetingJobRepository(tableName, 'us-east-1');
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      const input: CreateMeetingJobInput = {
        userId: 'user-123',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
        metadata: {
          meetingTitle: 'Team Standup',
          meetingDate: '2025-10-06',
        },
      };

      ddbMock.on(PutCommand).resolves({});

      const job = await repository.createJob(input);

      expect(job).toBeDefined();
      expect(job.jobId).toBeDefined();
      expect(job.userId).toBe(input.userId);
      expect(job.status).toBe('UPLOADED');
      expect(job.videoFileName).toBe(input.videoFileName);
      expect(job.videoS3Key).toBe(input.videoS3Key);
      expect(job.videoSize).toBe(input.videoSize);
      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
      expect(job.metadata).toEqual(input.metadata);
    });

    it('should throw error when DynamoDB fails', async () => {
      const input: CreateMeetingJobInput = {
        userId: 'user-123',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
      };

      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.createJob(input)).rejects.toThrow('Failed to create job');
    });
  });

  describe('getJob', () => {
    it('should retrieve a job successfully', async () => {
      const mockJob = {
        jobId: 'job-123',
        userId: 'user-123',
        status: 'UPLOADED' as JobStatus,
        createdAt: '2025-10-06T10:00:00Z',
        updatedAt: '2025-10-06T10:00:00Z',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
      };

      ddbMock.on(GetCommand).resolves({ Item: mockJob });

      const job = await repository.getJob('job-123', 'user-123');

      expect(job).toEqual(mockJob);
    });

    it('should return null when job not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const job = await repository.getJob('non-existent', 'user-123');

      expect(job).toBeNull();
    });

    it('should throw error when DynamoDB fails', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.getJob('job-123', 'user-123')).rejects.toThrow('Failed to get job');
    });
  });

  describe('updateJob', () => {
    it('should update job status successfully', async () => {
      const updatedJob = {
        jobId: 'job-123',
        userId: 'user-123',
        status: 'TRANSCRIBING' as JobStatus,
        createdAt: '2025-10-06T10:00:00Z',
        updatedAt: '2025-10-06T10:05:00Z',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
        transcribeJobName: 'transcribe-job-123',
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedJob });

      const job = await repository.updateJob({
        jobId: 'job-123',
        userId: 'user-123',
        status: 'TRANSCRIBING',
        transcribeJobName: 'transcribe-job-123',
      });

      expect(job.status).toBe('TRANSCRIBING');
      expect(job.transcribeJobName).toBe('transcribe-job-123');
    });

    it('should update multiple fields', async () => {
      const updatedJob = {
        jobId: 'job-123',
        userId: 'user-123',
        status: 'COMPLETED' as JobStatus,
        createdAt: '2025-10-06T10:00:00Z',
        updatedAt: '2025-10-06T10:30:00Z',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
        transcriptS3Key: 'transcripts/job-123/transcript.json',
        minutesS3Key: 'minutes/job-123/minutes.md',
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedJob });

      const job = await repository.updateJob({
        jobId: 'job-123',
        userId: 'user-123',
        status: 'COMPLETED',
        transcriptS3Key: 'transcripts/job-123/transcript.json',
        minutesS3Key: 'minutes/job-123/minutes.md',
      });

      expect(job.status).toBe('COMPLETED');
      expect(job.transcriptS3Key).toBe('transcripts/job-123/transcript.json');
      expect(job.minutesS3Key).toBe('minutes/job-123/minutes.md');
    });

    it('should throw error when DynamoDB fails', async () => {
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      await expect(
        repository.updateJob({
          jobId: 'job-123',
          userId: 'user-123',
          status: 'FAILED',
        })
      ).rejects.toThrow('Failed to update job');
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status with error message', async () => {
      const updatedJob = {
        jobId: 'job-123',
        userId: 'user-123',
        status: 'FAILED' as JobStatus,
        errorMessage: 'Transcription failed',
        createdAt: '2025-10-06T10:00:00Z',
        updatedAt: '2025-10-06T10:15:00Z',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-123/meeting.mp4',
        videoSize: 1024000,
      };

      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedJob });

      const job = await repository.updateJobStatus(
        'job-123',
        'user-123',
        'FAILED',
        'Transcription failed'
      );

      expect(job.status).toBe('FAILED');
      expect(job.errorMessage).toBe('Transcription failed');
    });
  });

  describe('listJobsByUser', () => {
    it('should list jobs for a user', async () => {
      const mockJobs = [
        {
          jobId: 'job-1',
          userId: 'user-123',
          status: 'COMPLETED' as JobStatus,
          createdAt: '2025-10-06T10:00:00Z',
          updatedAt: '2025-10-06T10:30:00Z',
          videoFileName: 'meeting1.mp4',
          videoS3Key: 'videos/user-123/meeting1.mp4',
          videoSize: 1024000,
        },
        {
          jobId: 'job-2',
          userId: 'user-123',
          status: 'TRANSCRIBING' as JobStatus,
          createdAt: '2025-10-06T09:00:00Z',
          updatedAt: '2025-10-06T09:05:00Z',
          videoFileName: 'meeting2.mp4',
          videoS3Key: 'videos/user-123/meeting2.mp4',
          videoSize: 2048000,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: mockJobs });

      const result = await repository.listJobsByUser({
        userId: 'user-123',
        limit: 10,
      });

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].jobId).toBe('job-1');
      expect(result.jobs[1].jobId).toBe('job-2');
    });

    it('should handle pagination', async () => {
      const mockJobs = [
        {
          jobId: 'job-3',
          userId: 'user-123',
          status: 'UPLOADED' as JobStatus,
          createdAt: '2025-10-06T08:00:00Z',
          updatedAt: '2025-10-06T08:00:00Z',
          videoFileName: 'meeting3.mp4',
          videoS3Key: 'videos/user-123/meeting3.mp4',
          videoSize: 1536000,
        },
      ];

      const lastEvaluatedKey = { jobId: 'job-2', userId: 'user-123' };

      ddbMock.on(QueryCommand).resolves({
        Items: mockJobs,
        LastEvaluatedKey: lastEvaluatedKey,
      });

      const result = await repository.listJobsByUser({
        userId: 'user-123',
        limit: 1,
        lastEvaluatedKey: { jobId: 'job-1', userId: 'user-123' },
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.lastEvaluatedKey).toEqual(lastEvaluatedKey);
    });

    it('should return empty array when no jobs found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repository.listJobsByUser({
        userId: 'user-123',
      });

      expect(result.jobs).toHaveLength(0);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should throw error when DynamoDB fails', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(
        repository.listJobsByUser({ userId: 'user-123' })
      ).rejects.toThrow('Failed to list jobs');
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await expect(
        repository.deleteJob('job-123', 'user-123')
      ).resolves.not.toThrow();
    });

    it('should throw error when DynamoDB fails', async () => {
      ddbMock.on(DeleteCommand).rejects(new Error('DynamoDB error'));

      await expect(
        repository.deleteJob('job-123', 'user-123')
      ).rejects.toThrow('Failed to delete job');
    });
  });
});
