import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ApiError } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key') || request.nextUrl.searchParams.get('key');
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' } satisfies ApiError,
        { status: 401 },
      );
    }

    console.log('[Admin] Starting database clear...');
    
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
    const docClient = DynamoDBDocumentClient.from(client);
    const TableName = process.env.DYNAMODB_TABLE_NAME || "BurstTable";

    let items = [];
    let lastEvaluatedKey = undefined;

    do {
      const res = await docClient.send(new ScanCommand({ TableName, ExclusiveStartKey: lastEvaluatedKey }));
      if (res.Items) items.push(...res.Items);
      lastEvaluatedKey = res.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    let count = 0;
    for (const item of items) {
      await docClient.send(new DeleteCommand({ TableName, Key: { PK: item.PK, SK: item.SK } }));
      count++;
    }

    return NextResponse.json({
      success: true,
      message: `Database cleared. Deleted ${count} items.`,
    });
  } catch (error) {
    console.error('[Admin] Database clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear database', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
