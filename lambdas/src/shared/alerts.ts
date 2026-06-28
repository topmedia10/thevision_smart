import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "./ddb";
import { enqueueSms } from "./sqs";
import { jerusalemDateKey } from "./dates";

export interface Employee {
  employeeId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  admin?: boolean;
  showInSms?: boolean;
  notifyLowBalance?: boolean;
}

/** Employees flagged to receive operational balance alerts. */
export async function getNotifyEmployees(): Promise<Employee[]> {
  const out: Employee[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.employees,
        FilterExpression: "notifyLowBalance = :t AND attribute_exists(phone)",
        ExpressionAttributeValues: { ":t": true },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) out.push(item as Employee);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

/**
 * Send an operational alert to flagged employees. NOT filtered by unsubscribe.
 * Each gets a per-day dedup key so the same alert isn't sent twice.
 */
export async function sendOperationalAlert(
  kind: "precheck" | "threshold" | "weeklysafety",
  message: string,
): Promise<number> {
  const employees = await getNotifyEmployees();
  const day = jerusalemDateKey();
  const jobs = employees
    .filter((e) => e.phone)
    .map((e) => ({
      to: e.phone!,
      body: message,
      dedupKey: `alert#${kind}#${e.phone}#${day}`,
      source: "alert" as const,
    }));
  if (jobs.length) await enqueueSms(jobs);
  return jobs.length;
}
