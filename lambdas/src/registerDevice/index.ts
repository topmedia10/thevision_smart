import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "../shared/ddb";
import { nowIso } from "../shared/dates";

interface RegisterBody {
  token?: string;
  platform?: "ios" | "android";
}

const json = (status: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  let body: RegisterBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { ok: false, error: "invalid json" });
  }

  const token = body.token?.trim();
  const platform = body.platform;
  if (!token || (platform !== "ios" && platform !== "android")) {
    return json(400, { ok: false, error: "token and platform required" });
  }

  const now = nowIso();
  // Upsert: refresh platform + lastSeen, keep the original createdAt.
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.deviceTokens,
      Key: { token },
      UpdateExpression:
        "SET platform = :p, lastSeen = :now, createdAt = if_not_exists(createdAt, :now)",
      ExpressionAttributeValues: { ":p": platform, ":now": now },
    }),
  );
  return json(200, { ok: true });
};
