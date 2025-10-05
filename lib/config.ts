import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AppConfig {
  // AWS Configuration
  awsAccountId: string;
  awsRegion: string;
  
  // Environment
  environment: string;
  appName: string;
  
  // S3 Configuration
  inputBucketName: string;
  outputBucketName: string;
  
  // DynamoDB Configuration
  jobsTableName: string;
  
  // Transcribe Configuration
  transcribeLanguageCode: string;
  
  // Bedrock Configuration
  bedrockModelId: string;
  bedrockRegion: string;
  
  // File Upload Limits
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  
  // API Configuration
  apiStage: string;
  corsAllowedOrigins: string[];
  
  // Optional: Cognito
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
}

/**
 * Get application configuration from environment variables
 */
export function getConfig(): AppConfig {
  return {
    // AWS Configuration
    awsAccountId: getEnvVar('AWS_ACCOUNT_ID', ''),
    awsRegion: getEnvVar('AWS_REGION', 'us-east-1'),
    
    // Environment
    environment: getEnvVar('ENVIRONMENT', 'dev'),
    appName: getEnvVar('APP_NAME', 'meeting-minutes-generator'),
    
    // S3 Configuration
    inputBucketName: getEnvVar('INPUT_BUCKET_NAME', ''),
    outputBucketName: getEnvVar('OUTPUT_BUCKET_NAME', ''),
    
    // DynamoDB Configuration
    jobsTableName: getEnvVar('JOBS_TABLE_NAME', ''),
    
    // Transcribe Configuration
    transcribeLanguageCode: getEnvVar('TRANSCRIBE_LANGUAGE_CODE', 'ja-JP'),
    
    // Bedrock Configuration
    bedrockModelId: getEnvVar('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0'),
    bedrockRegion: getEnvVar('BEDROCK_REGION', 'us-east-1'),
    
    // File Upload Limits
    maxFileSizeMB: parseInt(getEnvVar('MAX_FILE_SIZE_MB', '2048'), 10),
    allowedFileTypes: getEnvVar('ALLOWED_FILE_TYPES', 'video/mp4').split(','),
    
    // API Configuration
    apiStage: getEnvVar('API_STAGE', 'dev'),
    corsAllowedOrigins: getEnvVar('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
    
    // Optional: Cognito
    cognitoUserPoolId: getEnvVar('COGNITO_USER_POOL_ID'),
    cognitoClientId: getEnvVar('COGNITO_CLIENT_ID'),
  };
}

/**
 * Get environment variable with optional default value
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Validate required configuration
 */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];
  
  if (!config.awsAccountId && process.env.CDK_DEFAULT_ACCOUNT === undefined) {
    errors.push('AWS_ACCOUNT_ID is required');
  }
  
  if (!config.awsRegion) {
    errors.push('AWS_REGION is required');
  }
  
  if (config.maxFileSizeMB <= 0) {
    errors.push('MAX_FILE_SIZE_MB must be greater than 0');
  }
  
  if (config.allowedFileTypes.length === 0) {
    errors.push('ALLOWED_FILE_TYPES must contain at least one file type');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get Lambda environment variables
 */
export function getLambdaEnvironment(config: AppConfig): Record<string, string> {
  return {
    ENVIRONMENT: config.environment,
    INPUT_BUCKET_NAME: config.inputBucketName,
    OUTPUT_BUCKET_NAME: config.outputBucketName,
    JOBS_TABLE_NAME: config.jobsTableName,
    TRANSCRIBE_LANGUAGE_CODE: config.transcribeLanguageCode,
    BEDROCK_MODEL_ID: config.bedrockModelId,
    BEDROCK_REGION: config.bedrockRegion,
    MAX_FILE_SIZE_MB: config.maxFileSizeMB.toString(),
    ALLOWED_FILE_TYPES: config.allowedFileTypes.join(','),
  };
}
