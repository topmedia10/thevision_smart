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

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

/**
 * Weekly-SMS recipients via the audience-index GSI (PK unsubscribe="0", SK
 * lastVisitAt). Audience bucket + days filter become a lastVisitAt range;
 * unsubscribed are inherently excluded. EXCLUDES anyone who visited within the
 * last `filterDays` days (filterDays = 0 → no day filter).
 */
export async function selectWeeklyRecipients(
  filterDays: number,
  audienceKind: string,
  s: { activeMonths?: number; inactiveMonths?: number },
): Promise<Customer[]> {
  const activeCut = monthsAgoIso(s.activeMonths ?? 3);
  const inactiveCut = monthsAgoIso(s.inactiveMonths ?? 12);
  let lo: string | null = null;
  let hi: string | null = null;
  if (audienceKind === "active") lo = activeCut;
  else if (audienceKind === "stopped") {
    lo = inactiveCut;
    hi = activeCut;
  } else if (audienceKind === "inactive") hi = inactiveCut;
  if (filterDays > 0) {
    const dc = new Date(Date.now() - filterDays * 86400000).toISOString();
    hi = hi === null ? dc : dc < hi ? dc : hi;
  }
  if (lo !== null && hi !== null && lo > hi) return [];

  let sk = "";
  const values: Record<string, unknown> = { ":u": "0" };
  if (lo !== null && hi !== null) {
    sk = " AND lastVisitAt BETWEEN :lo AND :hi";
    values[":lo"] = lo;
    values[":hi"] = hi;
  } else if (lo !== null) {
    sk = " AND lastVisitAt >= :lo";
    values[":lo"] = lo;
  } else if (hi !== null) {
    sk = " AND lastVisitAt < :hi";
    values[":hi"] = hi;
  }

  const out: Customer[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLES.customers,
        IndexName: INDEXES.audienceIndex,
        KeyConditionExpression: `unsubscribe = :u${sk}`,
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) out.push(item as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}
