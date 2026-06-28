import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES, INDEXES } from "./ddb";

export interface Customer {
  phone: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  lastAppointmentEnd?: string;
  lastVisitAt?: string;
  sentWelcome?: string;
  sentReview?: string;
  unsubscribe?: string;
  unsubscribeIp?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Customers due for a review: sentReview="0" AND lastAppointmentEnd <= now,
 * excluding unsubscribed. Uses the review-index GSI.
 */
export async function queryReviewDue(nowIso: string): Promise<Customer[]> {
  const out: Customer[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLES.customers,
        IndexName: INDEXES.reviewIndex,
        KeyConditionExpression: "sentReview = :zero AND lastAppointmentEnd <= :now",
        FilterExpression: "unsubscribe = :u",
        ExpressionAttributeValues: { ":zero": "0", ":now": nowIso, ":u": "0" },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) out.push(item as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

export type AudienceKind = "active" | "stopped" | "inactive";

function monthsAgoMs(months: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

/** Bucket a customer by lastVisitAt against audience thresholds (months). */
export function audienceBucket(
  c: Customer,
  s: { activeMonths?: number; stoppedMonths?: number; inactiveMonths?: number },
): AudienceKind | null {
  if (!c.lastVisitAt) return null;
  const v = new Date(c.lastVisitAt).getTime();
  if (v >= monthsAgoMs(s.activeMonths ?? 3)) return "active";
  if (v < monthsAgoMs(s.stoppedMonths ?? 6) && v >= monthsAgoMs(s.inactiveMonths ?? 12))
    return "stopped";
  if (v < monthsAgoMs(s.inactiveMonths ?? 12)) return "inactive";
  return null;
}

/**
 * Weekly-SMS recipients: subscribed customers, optionally in an audience bucket,
 * who VISITED within the last `filterDays` days (filterDays = 0 → no day filter).
 * Shared by the weekly send and its pre-check so they always agree.
 */
export async function selectWeeklyRecipients(
  filterDays: number,
  audienceKind: string,
  audienceSettings: {
    activeMonths?: number;
    stoppedMonths?: number;
    inactiveMonths?: number;
  },
): Promise<Customer[]> {
  const all: Customer[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.customers,
        FilterExpression: "unsubscribe = :u",
        ExpressionAttributeValues: { ":u": "0" },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) all.push(item as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  const cut = filterDays > 0 ? Date.now() - filterDays * 86400000 : null;
  return all.filter((c) => {
    if (audienceKind !== "all" && audienceBucket(c, audienceSettings) !== audienceKind)
      return false;
    if (cut !== null) {
      if (!c.lastVisitAt || new Date(c.lastVisitAt).getTime() < cut) return false;
    }
    return true;
  });
}
