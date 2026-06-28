import "server-only";
import {
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { ddb } from "./aws/clients";
import { TABLES } from "./constants";

export interface SavedMessage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export async function listSavedMessages(): Promise<SavedMessage[]> {
  const out: SavedMessage[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: TABLES.savedMessages, ExclusiveStartKey }),
    );
    for (const i of res.Items ?? []) out.push(i as SavedMessage);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function upsertSavedMessage(
  title: string,
  body: string,
  id?: string,
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLES.savedMessages,
      Item: {
        id: id || uuid(),
        title,
        body,
        createdAt: new Date().toISOString(),
      },
    }),
  );
}

export async function deleteSavedMessage(id: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({ TableName: TABLES.savedMessages, Key: { id } }),
  );
}
