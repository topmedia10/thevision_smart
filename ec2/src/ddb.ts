import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { config } from "./config";

const client = new DynamoDBClient({ region: config.region });
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/** True if this dedupKey was already sent (idempotency guard). */
export async function alreadySent(dedupKey: string): Promise<boolean> {
  const res = await ddb.send(
    new GetCommand({
      TableName: config.tables.smsIdempotency,
      Key: { dedupKey },
      ConsistentRead: true,
    }),
  );
  return !!res.Item;
}

/** Mark a dedupKey as sent with a TTL (~7 days) so SQS at-least-once is safe. */
export async function markSent(dedupKey: string): Promise<void> {
  const ttl =
    Math.floor(Date.now() / 1000) + config.idempotencyTtlDays * 86400;
  await ddb.send(
    new PutCommand({
      TableName: config.tables.smsIdempotency,
      Item: { dedupKey, createdAt: new Date().toISOString(), ttl },
      // If two workers race the same key, the loser's condition fails — safe.
      ConditionExpression: "attribute_not_exists(dedupKey)",
    }),
  );
}

export interface ActivityLogEntry {
  message: string;
  to: string;
  credits: number;
  source: string;
  batchId?: string;
}

/** One row per successfully-sent message. */
export async function writeActivityLog(entry: ActivityLogEntry): Promise<void> {
  const sentAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: config.tables.smsActivityLog,
      Item: {
        pk: "LOG",
        sk: `${sentAt}#${uuid()}`,
        sentAt,
        message: entry.message,
        to: entry.to,
        recipientsCount: 1,
        credits: entry.credits,
        source: entry.source,
        batchId: entry.batchId,
        status: "sent",
      },
    }),
  );
}
