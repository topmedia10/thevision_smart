import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { REGION } from "../constants";

const dynamo = new DynamoDBClient({ region: REGION });
export const ddb = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: { removeUndefinedValues: true },
});
export const sqs = new SQSClient({ region: REGION });
export const scheduler = new SchedulerClient({ region: REGION });
export const lambda = new LambdaClient({ region: REGION });
