// ============================================================
// Burst — DynamoDB Client & Helpers
// ============================================================
// Single Document Client instance shared across all serverless
// invocations (warm starts reuse the connection).
// Includes TransactWriteItems support — the technical centerpiece.
// ============================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  TransactWriteCommand,
  BatchWriteCommand,
  type GetCommandInput,
  type PutCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

// ---- Configuration ----

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'BurstTable';
const REGION = process.env.AWS_REGION || 'us-east-1';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn(
    '[Burst] AWS credentials not found in environment variables.',
    'DynamoDB operations will fail.',
    'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
  );
}

// ---- Client Singleton ----

const client = new DynamoDBClient({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
  maxAttempts: 3,
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export { TABLE_NAME };

// ---- Error Handling ----

export class DynamoDBError extends Error {
  constructor(
    public readonly operation: string,
    public readonly cause: unknown,
  ) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`[DynamoDB ${operation}] ${msg}`);
    this.name = 'DynamoDBError';
  }
}

export class ConditionalCheckError extends Error {
  constructor(message: string = 'Conditional check failed') {
    super(message);
    this.name = 'ConditionalCheckError';
  }
}

export class TransactionCanceledError extends Error {
  public readonly cancellationReasons: string[];
  constructor(reasons: string[]) {
    super(`Transaction canceled: ${reasons.join(', ')}`);
    this.name = 'TransactionCanceledError';
    this.cancellationReasons = reasons;
  }
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ConditionalCheckFailedException' ||
      error.message.includes('ConditionalCheckFailed'))
  );
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TransactionCanceledException' ||
      error.message.includes('TransactionCanceledException'))
  );
}

function wrapDynamoError(operation: string, error: unknown): never {
  console.error(`[Burst] DynamoDB ${operation} failed:`, error instanceof Error ? error.message : error);
  throw new DynamoDBError(operation, error);
}

// ---- CRUD Helpers ----

export async function getItem<T>(
  pk: string,
  sk: string,
): Promise<T | null> {
  const params: GetCommandInput = {
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  };
  try {
    const result = await docClient.send(new GetCommand(params));
    return (result.Item as T) || null;
  } catch (error) {
    throw wrapDynamoError('GetItem', error);
  }
}

export async function putItem(
  item: Record<string, unknown>,
  conditionExpression?: string,
): Promise<void> {
  const params: PutCommandInput = {
    TableName: TABLE_NAME,
    Item: item,
    ...(conditionExpression && { ConditionExpression: conditionExpression }),
  };
  try {
    await docClient.send(new PutCommand(params));
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw new ConditionalCheckError('Item already exists or condition not met');
    }
    throw wrapDynamoError('PutItem', error);
  }
}

export async function queryItems<T>(
  keyCondition: string,
  expressionValues: Record<string, unknown>,
  options: {
    indexName?: string;
    scanForward?: boolean;
    limit?: number;
    filterExpression?: string;
    expressionNames?: Record<string, string>;
  } = {},
): Promise<T[]> {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
    ...(options.indexName && { IndexName: options.indexName }),
    ...(options.scanForward !== undefined && { ScanIndexForward: options.scanForward }),
    ...(options.limit && { Limit: options.limit }),
    ...(options.filterExpression && { FilterExpression: options.filterExpression }),
    ...(options.expressionNames && { ExpressionAttributeNames: options.expressionNames }),
  };
  try {
    const result = await docClient.send(new QueryCommand(params));
    return (result.Items as T[]) || [];
  } catch (error) {
    throw wrapDynamoError('Query', error);
  }
}

export async function updateItem(
  pk: string,
  sk: string,
  updateExpression: string,
  expressionValues: Record<string, unknown>,
  conditionExpression?: string,
  expressionNames?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const params: UpdateCommandInput = {
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
    ...(conditionExpression && { ConditionExpression: conditionExpression }),
    ...(expressionNames && { ExpressionAttributeNames: expressionNames }),
  };
  try {
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes || null;
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw new ConditionalCheckError();
    }
    throw wrapDynamoError('UpdateItem', error);
  }
}

// ============================================================
// TransactWriteItems — THE TECHNICAL CENTERPIECE
// ============================================================
// This is the core operation of Burst. A single atomic call that:
// 1. Checks inventory > 0 and decrements it
// 2. Creates a reservation with TTL
// 3. Prevents duplicate claims
// All-or-nothing. If any condition fails, nothing happens.
// No oversell is architecturally possible.
// ============================================================

export async function transactWrite(
  items: TransactWriteCommandInput['TransactItems'],
): Promise<void> {
  const params: TransactWriteCommandInput = {
    TransactItems: items,
  };
  try {
    await docClient.send(new TransactWriteCommand(params));
  } catch (error) {
    if (isTransactionCanceled(error)) {
      // Parse cancellation reasons from the error
      const reasons: string[] = [];
      const err = error as Error & { CancellationReasons?: Array<{ Code?: string; Message?: string }> };
      if (err.CancellationReasons) {
        for (const reason of err.CancellationReasons) {
          if (reason.Code && reason.Code !== 'None') {
            reasons.push(reason.Code);
          }
        }
      }
      throw new TransactionCanceledError(
        reasons.length > 0 ? reasons : ['ConditionalCheckFailed'],
      );
    }
    throw wrapDynamoError('TransactWriteItems', error);
  }
}

// ---- Batch Write (for seeding) ----

export async function batchWriteItems(
  items: Record<string, unknown>[],
): Promise<void> {
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const params = {
      RequestItems: {
        [TABLE_NAME]: batch.map(item => ({
          PutRequest: { Item: item },
        })),
      },
    };
    try {
      await docClient.send(new BatchWriteCommand(params));
    } catch (error) {
      throw wrapDynamoError('BatchWrite', error);
    }
  }
}

// ---- ID Generator ----

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
