import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const JOBS_TABLE = process.env.JOBS_TABLE_NAME!;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET_NAME!;

/**
 * Cognito認証からuserIdを取得
 */
function getUserIdFromEvent(event: APIGatewayProxyEvent): string | null {
  // Cognito認証の場合
  const claims = event.requestContext?.authorizer?.claims;
  if (claims && claims.sub) {
    return claims.sub;
  }

  // クエリパラメータから取得（開発用）
  if (event.queryStringParameters?.userId) {
    return event.queryStringParameters.userId;
  }

  return null;
}

/**
 * 議事録データからMarkdownを生成
 */
function generateMarkdown(data: any): string {
  const lines: string[] = [];

  lines.push('# 議事録');
  lines.push('');
  lines.push(`生成日時: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`);
  lines.push('');

  // 概要
  lines.push('## 概要');
  lines.push('');
  lines.push(data.summary || '');
  lines.push('');

  // 決定事項
  lines.push('## 決定事項');
  lines.push('');
  if (data.decisions && data.decisions.length > 0) {
    data.decisions.forEach((decision: any, index: number) => {
      const timestamp = decision.timestamp ? ` (${decision.timestamp})` : '';
      lines.push(`${index + 1}. ${decision.description}${timestamp}`);
    });
  } else {
    lines.push('決定事項はありません。');
  }
  lines.push('');

  // ネクストアクション
  lines.push('## ネクストアクション');
  lines.push('');
  if (data.nextActions && data.nextActions.length > 0) {
    data.nextActions.forEach((action: any, index: number) => {
      lines.push(`${index + 1}. ${action.description}`);
      if (action.assignee) {
        lines.push(`   - **担当**: ${action.assignee}`);
      }
      if (action.dueDate) {
        lines.push(`   - **期限**: ${action.dueDate}`);
      }
      if (action.timestamp) {
        lines.push(`   - **タイムスタンプ**: ${action.timestamp}`);
      }
      lines.push('');
    });
  } else {
    lines.push('ネクストアクションはありません。');
    lines.push('');
  }

  // 文字起こし全文（存在する場合）
  if (data.transcript) {
    lines.push('## 文字起こし全文');
    lines.push('');
    lines.push(data.transcript);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 議事録更新Lambda関数
 * PUT /api/jobs/{jobId}/minutes
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  };

  try {
    // パスパラメータからjobIdを取得
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'jobIdが指定されていません',
        }),
      };
    }

    // userIdを取得
    const userId = getUserIdFromEvent(event);
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: '認証が必要です',
        }),
      };
    }

    // リクエストボディをパース
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'リクエストボディが空です',
        }),
      };
    }

    const updates = JSON.parse(event.body);
    console.log('Updates:', JSON.stringify(updates, null, 2));

    // ジョブが存在するか確認
    const getResult = await docClient.send(
      new GetCommand({
        TableName: JOBS_TABLE,
        Key: { 
          jobId,
          userId,
        },
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'ジョブが見つかりません',
        }),
      };
    }

    // 更新可能なフィールドのみを抽出
    const allowedFields = [
      'summary',
      'keyPoints',
      'decisions',
      'nextActions',
      'participants',
      'meetingDate',
    ];

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // 更新フィールドを構築
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = updates[field];
      }
    }

    // 更新するフィールドがない場合
    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: '更新するフィールドがありません',
        }),
      };
    }

    // 更新日時を追加
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // DynamoDBを更新
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: JOBS_TABLE,
        Key: { 
          jobId,
          userId,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    console.log('Update result:', JSON.stringify(updateResult, null, 2));

    // S3のMarkdownファイルも更新（minutesS3Keyが存在する場合）
    if (getResult.Item.minutesS3Key) {
      try {
        const markdownContent = generateMarkdown(updateResult.Attributes);
        await s3Client.send(
          new PutObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: getResult.Item.minutesS3Key,
            Body: markdownContent,
            ContentType: 'text/markdown',
          })
        );
        console.log('Updated S3 markdown file:', getResult.Item.minutesS3Key);
      } catch (s3Error) {
        console.error('Failed to update S3 file:', s3Error);
        // S3更新失敗はエラーとしない（DynamoDBは更新済み）
      }
    }

    // レスポンスデータを整形（get-minutesと同じ形式に合わせる）
    const responseData = {
      jobId: updateResult.Attributes?.jobId,
      userId: updateResult.Attributes?.userId,
      generatedAt: updateResult.Attributes?.updatedAt, // 更新日時を生成日時として返す
      summary: updateResult.Attributes?.summary,
      decisions: updateResult.Attributes?.decisions || [],
      nextActions: updateResult.Attributes?.nextActions || [],
      participants: updateResult.Attributes?.participants,
      meetingDate: updateResult.Attributes?.meetingDate,
      transcript: updateResult.Attributes?.transcript || '',
      speakers: updateResult.Attributes?.speakers || [],
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: responseData,
      }),
    };
  } catch (error) {
    console.error('Error updating minutes:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: '議事録の更新に失敗しました',
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
