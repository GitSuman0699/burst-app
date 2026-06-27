import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

async function clear() {
  const TableName = process.env.DYNAMODB_TABLE_NAME || "BurstTable";
  console.log("Scanning table:", TableName);
  let items = [];
  let lastEvaluatedKey = undefined;

  do {
    const res = await docClient.send(new ScanCommand({ TableName, ExclusiveStartKey: lastEvaluatedKey }));
    if (res.Items) items.push(...res.Items);
    lastEvaluatedKey = res.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Found ${items.length} items. Deleting...`);

  let count = 0;
  for (const item of items) {
    await docClient.send(new DeleteCommand({ TableName, Key: { PK: item.PK, SK: item.SK } }));
    count++;
    if (count % 100 === 0) console.log(`Deleted ${count} items...`);
  }

  console.log("Done! Database is clear.");
}

clear().catch(console.error);
