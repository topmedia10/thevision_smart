import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  customers: process.env.TABLE_CUSTOMERS!,
  employees: process.env.TABLE_EMPLOYEES!,
  settings: process.env.TABLE_SETTINGS!,
  savedMessages: process.env.TABLE_SAVED_MESSAGES!,
  smsActivityLog: process.env.TABLE_SMS_ACTIVITY_LOG!,
  deviceTokens: process.env.TABLE_DEVICE_TOKENS!,
  smsIdempotency: process.env.TABLE_SMS_IDEMPOTENCY!,
};

export const INDEXES = {
  reviewIndex: process.env.GSI_REVIEW_INDEX || "review-index",
  phoneIndex: process.env.GSI_PHONE_INDEX || "phone-index",
};
