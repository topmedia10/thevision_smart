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

/**
 * Weekly-SMS audience: lastVisitAt < cutoffIso AND unsubscribe="0".
 * (Scan with filter; the customer base is small per-business.)
 */
export async function scanWeeklyAudience(cutoffIso: string): Promise<Customer[]> {
  const out: Customer[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.customers,
        FilterExpression:
          "unsubscribe = :u AND attribute_exists(lastVisitAt) AND lastVisitAt < :cut",
        ExpressionAttributeValues: { ":u": "0", ":cut": cutoffIso },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) out.push(item as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}
