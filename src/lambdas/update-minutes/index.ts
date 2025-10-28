import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const JOBS_TABLE = process.env.JOBS_TABLE_NAME!;

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
        Key: { jobId },
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
        Key: { jobId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    console.log('Update result:', JSON.stringify(updateResult, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: updateResult.Attributes,
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
