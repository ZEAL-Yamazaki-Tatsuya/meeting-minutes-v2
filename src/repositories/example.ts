/**
 * Example usage of MeetingJobRepository
 * This file demonstrates how to use the repository in Lambda functions
 */

import { MeetingJobRepository } from './meeting-job-repository';

// Initialize repository
const repository = new MeetingJobRepository(
  process.env.JOBS_TABLE_NAME || 'meeting-minutes-jobs-dev',
  process.env.AWS_REGION || 'us-east-1'
);

/**
 * Example: Create a new job when a video is uploaded
 */
export async function handleVideoUpload(
  userId: string,
  fileName: string,
  s3Key: string,
  fileSize: number
) {
  try {
    const job = await repository.createJob({
      userId,
      videoFileName: fileName,
      videoS3Key: s3Key,
      videoSize: fileSize,
      metadata: {
        meetingTitle: 'Extracted from filename or metadata',
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId: job.jobId,
        status: job.status,
        message: 'Video uploaded successfully',
      }),
    };
  } catch (error) {
    console.error('Error handling video upload:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create job',
      }),
    };
  }
}

/**
 * Example: Update job status when transcription starts
 */
export async function handleTranscriptionStart(
  jobId: string,
  userId: string,
  transcribeJobName: string
) {
  try {
    await repository.updateJob({
      jobId,
      userId,
      status: 'TRANSCRIBING',
      transcribeJobName,
    });

    console.log(`Transcription started for job: ${jobId}`);
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

/**
 * Example: Update job when transcription completes
 */
export async function handleTranscriptionComplete(
  jobId: string,
  userId: string,
  transcriptS3Key: string,
  duration: number
) {
  try {
    await repository.updateJob({
      jobId,
      userId,
      status: 'GENERATING',
      transcriptS3Key,
      videoDuration: duration,
    });

    console.log(`Transcription completed for job: ${jobId}`);
  } catch (error) {
    console.error('Error updating job:', error);
    throw error;
  }
}

/**
 * Example: Update job when minutes generation completes
 */
export async function handleMinutesComplete(
  jobId: string,
  userId: string,
  minutesS3Key: string
) {
  try {
    await repository.updateJob({
      jobId,
      userId,
      status: 'COMPLETED',
      minutesS3Key,
    });

    console.log(`Minutes generated for job: ${jobId}`);
  } catch (error) {
    console.error('Error updating job:', error);
    throw error;
  }
}

/**
 * Example: Handle job failure
 */
export async function handleJobFailure(
  jobId: string,
  userId: string,
  errorMessage: string
) {
  try {
    await repository.updateJobStatus(jobId, userId, 'FAILED', errorMessage);

    console.log(`Job failed: ${jobId}, error: ${errorMessage}`);
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

/**
 * Example: Get job status (for API endpoint)
 */
export async function getJobStatus(jobId: string, userId: string) {
  try {
    const job = await repository.getJob(jobId, userId);

    if (!job) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Job not found',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId: job.jobId,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        videoFileName: job.videoFileName,
        errorMessage: job.errorMessage,
        metadata: job.metadata,
      }),
    };
  } catch (error) {
    console.error('Error getting job status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get job status',
      }),
    };
  }
}

/**
 * Example: List user's jobs (for API endpoint)
 */
export async function listUserJobs(userId: string, limit?: number, lastKey?: any) {
  try {
    const result = await repository.listJobsByUser({
      userId,
      limit: limit || 50,
      lastEvaluatedKey: lastKey,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobs: result.jobs.map(job => ({
          jobId: job.jobId,
          status: job.status,
          createdAt: job.createdAt,
          videoFileName: job.videoFileName,
          metadata: job.metadata,
        })),
        lastEvaluatedKey: result.lastEvaluatedKey,
      }),
    };
  } catch (error) {
    console.error('Error listing jobs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to list jobs',
      }),
    };
  }
}
