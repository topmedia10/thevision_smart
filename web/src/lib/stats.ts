import "server-only";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES } from "./constants";

/** Total customers (Scan COUNT — base is small per business). */
export async function getCustomersCount(): Promise<number> {
  let count = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.customers,
        Select: "COUNT",
        ExclusiveStartKey,
      }),
    );
    count += res.Count ?? 0;
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return count;
}

export interface ActivityRow {
  sentAt: string;
  message: string;
  recipientsCount: number;
  credits: number | null;
  source: string;
  status: string;
  batchId?: string;
  to?: string;
}

/** Most recent activity-log rows (newest first). */
export async function getRecentActivity(limit = 50): Promise<ActivityRow[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLES.smsActivityLog,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "LOG" },
      ScanIndexForward: false, // newest first
      Limit: limit,
    }),
  );
  return (res.Items ?? []) as ActivityRow[];
}

export interface CampaignRow {
  key: string;
  source: string;
  message: string;
  sentAt: string;
  recipientsCount: number;
  credits: number;
}

/**
 * Activity report grouped into campaigns. The worker writes one row per sent
 * message; we group by batchId (manual/weekly campaigns) and leave one-off
 * sources (welcome/review/test/otp) grouped by source+day.
 */
export async function getCampaignReport(scanLimit = 1000): Promise<CampaignRow[]> {
  const rows: ActivityRow[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLES.smsActivityLog,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "LOG" },
        ScanIndexForward: false,
        Limit: 200,
        ExclusiveStartKey,
      }),
    );
    for (const i of res.Items ?? []) rows.push(i as ActivityRow);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey && rows.length < scanLimit);

  const groups = new Map<string, CampaignRow>();
  for (const r of rows) {
    const key = r.batchId
      ? r.batchId
      : `${r.source}#${(r.sentAt || "").slice(0, 10)}`;
    const g = groups.get(key);
    if (g) {
      g.recipientsCount += r.recipientsCount ?? 1;
      g.credits += r.credits ?? 0;
      if (r.sentAt < g.sentAt) g.sentAt = r.sentAt;
    } else {
      groups.set(key, {
        key,
        source: r.source,
        message: r.message,
        sentAt: r.sentAt,
        recipientsCount: r.recipientsCount ?? 1,
        credits: r.credits ?? 0,
      });
    }
  }
  return [...groups.values()].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}
