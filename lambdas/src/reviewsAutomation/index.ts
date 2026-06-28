import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "../shared/ddb";
import { getSettings, ReviewsSettings, BusinessSettings } from "../shared/settings";
import { queryReviewDue } from "../shared/customers";
import { enqueueSms, SmsJob } from "../shared/sqs";
import { renderMessage } from "../shared/vars";
import { nowIso } from "../shared/dates";

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
  const reviews = await getSettings<ReviewsSettings>("reviews");
  if (!reviews.enabled || !reviews.message) {
    console.log("reviews automation disabled or no message");
    return;
  }

  const due = await queryReviewDue(nowIso());
  if (!due.length) {
    console.log("no customers due for review");
    return;
  }

  const business = await getSettings<BusinessSettings>("business");
  let sent = 0;

  for (const c of due) {
    const employee = await getEmployee(c.employeeId);
    const body = renderMessage(reviews.message, {
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      employeeFirstName: employee?.firstName,
      employeeLastName: employee?.lastName,
    });
    const job: SmsJob = {
      to: c.phone,
      body,
      dedupKey: `review#${c.phone}#${c.lastAppointmentEnd}`,
      source: "review",
    };
    // Mark sentReview FIRST with a guard so we never enqueue twice even if the
    // Lambda is retried. Idempotency in the worker is the second safety net.
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLES.customers,
          Key: { phone: c.phone },
          UpdateExpression: "SET sentReview = :one, updatedAt = :now",
          ConditionExpression: "sentReview = :zero",
          ExpressionAttributeValues: {
            ":one": "1",
            ":zero": "0",
            ":now": nowIso(),
          },
        }),
      );
    } catch (e) {
      // Conditional check failed → already marked, skip.
      continue;
    }
    await enqueueSms([job]);
    sent++;
  }
  console.log(`reviews automation: enqueued ${sent} of ${due.length}`);
  void business;
};
