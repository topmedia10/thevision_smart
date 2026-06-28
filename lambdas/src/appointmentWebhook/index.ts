import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "../shared/ddb";
import { normalizeIsraeliPhone } from "../shared/phone";
import { parseLocalDateTimeToIso, addMinutesIso, nowIso } from "../shared/dates";
import { getSettings, ReviewsSettings, WelcomeSettings, BusinessSettings } from "../shared/settings";
import { getSecretString } from "../shared/secrets";
import { enqueueSms } from "../shared/sqs";
import { renderMessage } from "../shared/vars";

interface WebhookBody {
  CustomerFullName?: string;
  CustomerPhone?: string;
  SelectedServices?: string;
  StartDate?: string;
  EndDate?: string;
  CreateDate?: string;
  Duration?: string;
  ByCustomer?: string;
  BusinessName?: string;
  BusinessId?: string;
  Source?: string;
  EmployeeName?: string;
  EmployeeId?: string;
}

const json = (status: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  // --- auth: shared secret via header OR query param -------------------
  // Booking systems that can only POST JSON (no custom headers) can pass the
  // secret in the URL: .../webhook/appointment?token=<secret>
  const expected = await getSecretString(process.env.WEBHOOK_SECRET_ARN!);
  const provided =
    event.headers?.["x-webhook-secret"] ??
    event.headers?.["X-Webhook-Secret"] ??
    event.queryStringParameters?.token ??
    event.queryStringParameters?.secret;
  if (!provided || provided !== expected) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { ok: false, error: "invalid json" });
  }

  const phone = normalizeIsraeliPhone(body.CustomerPhone);
  if (!phone) return json(400, { ok: false, error: "invalid phone" });
  if (!body.EndDate || !body.CreateDate)
    return json(400, { ok: false, error: "missing dates" });

  // name split: first token = firstName, rest = lastName
  const nameParts = (body.CustomerFullName ?? "").trim().split(/\s+/);
  const firstName = nameParts.shift() ?? "";
  const lastName = nameParts.join(" ");

  const reviews = await getSettings<ReviewsSettings>("reviews");
  const delayMinutes = Number(reviews.delayMinutes ?? 0);

  const endIso = parseLocalDateTimeToIso(body.EndDate);
  const lastVisitAt = endIso;
  const lastAppointmentEnd = addMinutesIso(endIso, delayMinutes);
  const now = nowIso();
  const employeeId = body.EmployeeId ?? "";

  const existing = await ddb.send(
    new GetCommand({ TableName: TABLES.customers, Key: { phone } }),
  );

  if (!existing.Item) {
    // --- new customer --------------------------------------------------
    const welcome = await getSettings<WelcomeSettings>("welcome");
    const sentWelcome = "1"; // set in all branches (one-time, never retroactive)

    await ddb.send(
      new PutCommand({
        TableName: TABLES.customers,
        Item: {
          phone,
          firstName,
          lastName,
          employeeId,
          lastAppointmentEnd,
          lastVisitAt,
          sentWelcome,
          sentReview: "0",
          unsubscribe: "0",
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(phone)",
      }),
    );

    if (welcome.enabled && welcome.message) {
      const business = await getSettings<BusinessSettings>("business");
      const employee = await getEmployee(employeeId);
      const text = renderMessage(welcome.message, {
        customerFirstName: firstName,
        customerLastName: lastName,
        employeeFirstName: employee?.firstName,
        employeeLastName: employee?.lastName,
      });
      // CreateDate without time portion → stable dedup across retries.
      const createDay = body.CreateDate.split(" ")[0];
      await enqueueSms([
        {
          to: phone,
          body: text,
          dedupKey: `welcome#${phone}#${createDay}`,
          source: "welcome",
        },
      ]);
    }
    return json(200, { ok: true, customer: "created" });
  }

  // --- existing customer: update visit fields only -----------------------
  // Never touch sentWelcome / sentReview (both strictly one-time).
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.customers,
      Key: { phone },
      UpdateExpression:
        "SET employeeId = :e, lastAppointmentEnd = :lae, lastVisitAt = :lv, updatedAt = :u, firstName = if_not_exists(firstName, :fn), lastName = if_not_exists(lastName, :ln)",
      ExpressionAttributeValues: {
        ":e": employeeId,
        ":lae": lastAppointmentEnd,
        ":lv": lastVisitAt,
        ":u": now,
        ":fn": firstName,
        ":ln": lastName,
      },
    }),
  );
  return json(200, { ok: true, customer: "updated" });
};

async function getEmployee(
  employeeId: string,
): Promise<{ firstName?: string; lastName?: string } | undefined> {
  if (!employeeId) return undefined;
  const res = await ddb.send(
    new GetCommand({ TableName: TABLES.employees, Key: { employeeId } }),
  );
  return res.Item as { firstName?: string; lastName?: string } | undefined;
}
