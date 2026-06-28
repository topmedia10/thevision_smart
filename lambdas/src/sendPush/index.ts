import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

// All app installs subscribe to this FCM topic (see docs/REACT_NATIVE_FCM.md).
const TOPIC = process.env.FCM_TOPIC || "all";

let app: admin.app.App | null = null;
async function getMessaging(): Promise<admin.messaging.Messaging> {
  if (!app) {
    const serviceAccount = await getSecretJson(process.env.FIREBASE_SECRET_ARN!);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }
  return admin.messaging(app);
}

export const handler = async (
  event: SendPushEvent = {},
): Promise<{ ok: boolean; messageId?: string; error?: string }> => {
  let title = event.title;
  let body = event.body;

  if (event.trigger === "weekly" || !title || !body) {
    const wp = await getSettings<WeeklyPushSettings>("weeklyPush");
    if (event.trigger === "weekly" && !wp.enabled) {
      console.log("weekly push disabled");
      return { ok: true };
    }
    title = title ?? wp.title;
    body = body ?? wp.body;
  }
  if (!title || !body) throw new Error("push requires title and body");

  // Topic send: one call reaches every subscribed device. FCM returns only a
  // message id (no per-device count) — that's the accepted trade-off for topics.
  const messaging = await getMessaging();
  const messageId = await messaging.send({
    topic: TOPIC,
    notification: { title, body },
  });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.settings,
      Key: { pk: "SETTINGS", sk: "runtime" },
      UpdateExpression: "SET lastPushSentAt = :t REMOVE lastPushCount",
      ExpressionAttributeValues: { ":t": nowIso() },
    }),
  );

  console.log("push sent to topic", { topic: TOPIC, messageId });
  return { ok: true, messageId };
};
