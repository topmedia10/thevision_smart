import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { ddb, TABLES } from "../shared/ddb";
import {
  getSettings,
  WeeklySmsSettings,
  AlertsSettings,
  AudienceSettings,
} from "../shared/settings";
import { scanWeeklyAudience, audienceBucket } from "../shared/customers";
import { enqueueSms, SmsJob } from "../shared/sqs";
import { renderMessage } from "../shared/vars";
import { isoDaysAgo, jerusalemDateKey } from "../shared/dates";
import { getSmsBalance } from "../shared/ec2";
import { sendOperationalAlert } from "../shared/alerts";

const employeeCache = new Map<string, { firstName?: string; lastName?: string }>();
async function getEmployee(id?: string) {
  if (!id) return undefined;
  if (employeeCache.has(id)) return employeeCache.get(id);
  const res = await ddb.send(
    new GetCommand({ TableName: TABLES.employees, Key: { employeeId: id } }),
  );
  const emp = res.Item as { firstName?: string; lastName?: string } | undefined;
  if (emp) employeeCache.set(id, emp);
  return emp;
}

export const handler = async (): Promise<void> => {
  const weekly = await getSettings<WeeklySmsSettings>("weeklySms");
  if (!weekly.enabled || !weekly.message) {
    console.log("weekly sms disabled or no message");
    return;
  }

  const filterDays = Number(weekly.filterDays ?? 1);
  const cutoff = isoDaysAgo(filterDays);
  let audience = await scanWeeklyAudience(cutoff);

  // Optional audience-bucket filter (פעילים / הפסיקו / לא פעילים).
  const audienceKind = weekly.audience ?? "all";
  if (audienceKind !== "all") {
    const audienceSettings = await getSettings<AudienceSettings>("audience");
    audience = audience.filter(
      (c) => audienceBucket(c, audienceSettings) === audienceKind,
    );
  }

  if (!audience.length) {
    console.log("weekly sms: no recipients");
    return;
  }

  // Final safety check: balance must cover the blast (avoid partial send).
  const alerts = await getSettings<AlertsSettings>("alerts");
  let balance: number;
  try {
    balance = await getSmsBalance();
  } catch (e) {
    console.error("weekly sms: balance check failed, aborting", e);
    return;
  }
  if (balance < audience.length) {
    console.warn(
      `weekly sms: insufficient balance ${balance} < ${audience.length}, aborting`,
    );
    await sendOperationalAlert(
      "weeklysafety",
      alerts.weeklyPrecheckMessage ?? "אין מספיק יתרה לשליחה השבועית.",
    );
    return;
  }

  const day = jerusalemDateKey();
  // One batch id groups all activity-log rows the worker writes for this run.
  const batchId = `weekly-${day}-${uuid().slice(0, 8)}`;
  const jobs: SmsJob[] = [];
  for (const c of audience) {
    const employee = await getEmployee(c.employeeId);
    jobs.push({
      to: c.phone,
      body: renderMessage(weekly.message, {
        customerFirstName: c.firstName,
        customerLastName: c.lastName,
        employeeFirstName: employee?.firstName,
        employeeLastName: employee?.lastName,
      }),
      dedupKey: `weekly#${c.phone}#${day}`,
      source: "weekly",
      batchId,
    });
  }
  await enqueueSms(jobs);
  // The SQS worker is the single source of truth for SmsActivityLog: it writes
  // one row per successfully-sent message (with real credits), grouped by batchId.
  console.log(`weekly sms: enqueued ${jobs.length} recipients (batch ${batchId})`);
};
