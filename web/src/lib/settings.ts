import "server-only";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES, SETTINGS_PK } from "./constants";

export type SettingsGroup =
  | "business"
  | "welcome"
  | "reviews"
  | "weeklySms"
  | "weeklyPush"
  | "audience"
  | "alerts"
  | "runtime";

export interface BusinessSettings {
  businessName?: string;
  businessAddress?: string;
  bookingLink?: string;
  googleReviewLink?: string;
  smsUnsubscribeLink?: string;
}
export interface WelcomeSettings { enabled?: boolean; message?: string }
export interface ReviewsSettings {
  enabled?: boolean;
  delayMinutes?: number;
  message?: string;
}
export interface WeeklySmsSettings {
  enabled?: boolean;
  dayOfWeek?: number;
  time?: string;
  filterDays?: number;
  message?: string;
}
export interface WeeklyPushSettings {
  enabled?: boolean;
  dayOfWeek?: number;
  time?: string;
  title?: string;
  body?: string;
}
export interface AudienceSettings {
  activeMonths?: number;
  stoppedMonths?: number;
  inactiveMonths?: number;
}
export interface AlertsSettings {
  weeklyPrecheckMessage?: string;
  lowBalanceThreshold?: number;
  lowBalanceMessage?: string;
}
export interface RuntimeSettings {
  lastPushCount?: number;
  lastPushSentAt?: string;
  lastManualSms?: Record<string, unknown>;
  lowBalanceAlerted?: boolean;
}

export async function getSettings<T = Record<string, unknown>>(
  group: SettingsGroup,
): Promise<T> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLES.settings,
      Key: { pk: SETTINGS_PK, sk: group },
    }),
  );
  return (res.Item ?? {}) as T;
}

/** Full replace of a settings group (preserves pk/sk). */
export async function putSettings(
  group: SettingsGroup,
  data: Record<string, unknown>,
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLES.settings,
      Item: { pk: SETTINGS_PK, sk: group, ...data },
    }),
  );
}

/** Merge specific keys into a settings group (e.g. runtime snapshots). */
export async function patchSettings(
  group: SettingsGroup,
  data: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = keys.map((k, i) => {
    names[`#k${i}`] = k;
    values[`:v${i}`] = data[k];
    return `#k${i} = :v${i}`;
  });
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.settings,
      Key: { pk: SETTINGS_PK, sk: group },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}
