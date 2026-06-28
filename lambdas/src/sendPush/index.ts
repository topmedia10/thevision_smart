import { ScanCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import * as admin from "firebase-admin";
import { ddb, TABLES } from "../shared/ddb";
import { getSecretJson } from "../shared/secrets";
import { getSettings, WeeklyPushSettings } from "../shared/settings";
import { nowIso } from "../shared/dates";

interface SendPushEvent {
  trigger?: "weekly" | "manual";
  title?: string;
  body?: string;
}

let app: admin.app.App | null = null;
async function getMessaging(): Promise<admin.messaging.Messaging> {
  if (!app) {
    const serviceAccount = await getSecretJson(
      process.env.FIREBASE_SECRET_ARN!,
    );
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }
  return admin.messaging(app);
}

async function getAllTokens(): Promise<string[]> {
  const tokens: string[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.deviceTokens,
        ProjectionExpression: "#t",
        ExpressionAttributeNames: { "#t": "token" },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) tokens.push((item as { token: string }).token);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return tokens;
}

export const handler = async (event: SendPushEvent = {}): Promise<{
  ok: boolean;
  successCount: number;
  failureCount: number;
}> => {
  let title = event.title;
  let body = event.body;

  if (event.trigger === "weekly" || !title || !body) {
    const wp = await getSettings<WeeklyPushSettings>("weeklyPush");
    if (event.trigger === "weekly" && !wp.enabled) {
      console.log("weekly push disabled");
      return { ok: true, successCount: 0, failureCount: 0 };
    }
    title = title ?? wp.title;
    body = body ?? wp.body;
  }
  if (!title || !body) {
    throw new Error("push requires title and body");
  }

  const tokens = await getAllTokens();
  if (!tokens.length) {
    await writeRuntime(0);
    return { ok: true, successCount: 0, failureCount: 0 };
  }

  const messaging = await getMessaging();
  let successCount = 0;
  let failureCount = 0;
  const toPrune: string[] = [];

  // FCM multicast cap = 500 tokens per call.
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
    });
    successCount += res.successCount;
    failureCount += res.failureCount;
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code ?? "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          toPrune.push(batch[idx]);
        }
      }
    });
  }

  // Prune dead tokens so the count stays real.
  for (const token of toPrune) {
    await ddb.send(
      new DeleteCommand({ TableName: TABLES.deviceTokens, Key: { token } }),
    );
  }

  await writeRuntime(successCount);
  console.log(
    `push: success=${successCount} failure=${failureCount} pruned=${toPrune.length}`,
  );
  return { ok: true, successCount, failureCount };
};

async function writeRuntime(count: number): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.settings,
      Key: { pk: "SETTINGS", sk: "runtime" },
      UpdateExpression: "SET lastPushCount = :c, lastPushSentAt = :t",
      ExpressionAttributeValues: { ":c": count, ":t": nowIso() },
    }),
  );
}
