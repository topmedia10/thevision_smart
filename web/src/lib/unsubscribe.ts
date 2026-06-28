import "server-only";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES } from "./constants";

/**
 * Mark a customer unsubscribed (idempotent). Returns silently whether or not
 * the number existed — the caller must not reveal existence.
 */
export async function applyUnsubscribe(phone: string, ip: string): Promise<void> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLES.customers, Key: { phone } }),
  );
  if (!res.Item) return;
  if (res.Item.unsubscribe && res.Item.unsubscribe !== "0") return; // already
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.customers,
      Key: { phone },
      UpdateExpression: "SET unsubscribe = :ts, unsubscribeIp = :ip, updatedAt = :ts",
      ExpressionAttributeValues: {
        ":ts": new Date().toISOString(),
        ":ip": ip,
      },
    }),
  );
}

/** Verify a reCAPTCHA token server-side. */
export async function verifyRecaptcha(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return false;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
