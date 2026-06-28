/**
 * Single source of truth for physical resource names and shared conventions.
 * Apps read the actual names from environment variables (populated from the CDK
 * outputs below) — they must not import this file directly.
 */

export const REGION = "il-central-1";
export const TIMEZONE = "Asia/Jerusalem";

/** Existing EC2 instance with the whitelisted Elastic IP (Global SMS). */
export const EC2_INSTANCE_ID = "i-08b5b54881a151608";
export const EC2_ELASTIC_IP = "51.84.169.45";

export const TABLES = {
  customers: "smart-customers",
  employees: "smart-employees",
  settings: "smart-settings",
  savedMessages: "smart-saved-messages",
  smsActivityLog: "smart-sms-activity-log",
  deviceTokens: "smart-device-tokens",
  smsIdempotency: "smart-sms-idempotency",
} as const;

export const GSI = {
  reviewIndex: "review-index", // customers: PK sentReview, SK lastAppointmentEnd
  phoneIndex: "phone-index", // employees: PK phone
} as const;

export const QUEUES = {
  main: "sms-outbox",
  dlq: "sms-outbox-dlq",
} as const;

export const LAMBDAS = {
  appointmentWebhook: "smart-appointmentWebhook",
  reviewsAutomation: "smart-reviewsAutomation",
  weeklySmsAutomation: "smart-weeklySmsAutomation",
  weeklyPrecheck: "smart-weeklyPrecheck",
  balanceMonitor: "smart-balanceMonitor",
  sendPush: "smart-sendPush",
  registerDevice: "smart-registerDevice",
} as const;

export const SCHEDULES = {
  reviews: "smart-reviews",
  weeklySms: "smart-weekly-sms",
  weeklySmsPrecheck: "smart-weekly-sms-precheck",
  weeklyPush: "smart-weekly-push",
  balanceMonitor: "smart-balance-monitor",
} as const;

export const SECRETS = {
  globalSms: "smart/global-sms", // { apiKey, originator } — EC2 only
  ec2ApiToken: "smart/ec2-api-token", // bearer token — EC2 + Lambdas + Vercel
  webhookSecret: "smart/webhook-secret", // shared secret — API GW webhook
  firebaseServiceAccount: "smart/firebase-service-account", // sendPush only
} as const;

export const SETTINGS_PK = "SETTINGS";
export const SETTINGS_GROUPS = [
  "business",
  "welcome",
  "reviews",
  "weeklySms",
  "weeklyPush",
  "audience",
  "alerts",
  "runtime",
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

/** SQS message contract: one message == one SMS. */
export interface SmsJob {
  to: string; // E.164
  body: string; // already variable-replaced
  dedupKey: string;
  source:
    | "manual"
    | "welcome"
    | "review"
    | "weekly"
    | "otp"
    | "test"
    | "alert";
}
