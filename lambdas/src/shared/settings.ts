import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "./ddb";

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
export interface WelcomeSettings {
  enabled?: boolean;
  message?: string;
}
export interface ReviewsSettings {
  enabled?: boolean;
  delayMinutes?: number;
  message?: string;
}
export interface WeeklySmsSettings {
  enabled?: boolean;
  dayOfWeek?: number; // 0=Sun..6=Sat
  time?: string; // "HH:mm"
  filterDays?: number; // 1..10
  audience?: string; // "all" | "active" | "stopped" | "inactive"
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

const PK = "SETTINGS";

export async function getSettings<T = Record<string, unknown>>(
  group: SettingsGroup,
): Promise<T> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLES.settings,
      Key: { pk: PK, sk: group },
    }),
  );
  return (res.Item ?? {}) as T;
}
