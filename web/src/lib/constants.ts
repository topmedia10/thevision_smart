/** Resource names + config, read from server env (CDK outputs / secrets). */
export const REGION = process.env.AWS_REGION || "il-central-1";
export const TIMEZONE = process.env.TIMEZONE || "Asia/Jerusalem";

export const TABLES = {
  customers: process.env.TABLE_CUSTOMERS || "smart-customers",
  employees: process.env.TABLE_EMPLOYEES || "smart-employees",
  settings: process.env.TABLE_SETTINGS || "smart-settings",
  savedMessages: process.env.TABLE_SAVED_MESSAGES || "smart-saved-messages",
  smsActivityLog: process.env.TABLE_SMS_ACTIVITY_LOG || "smart-sms-activity-log",
  deviceTokens: process.env.TABLE_DEVICE_TOKENS || "smart-device-tokens",
  smsIdempotency: process.env.TABLE_SMS_IDEMPOTENCY || "smart-sms-idempotency",
};

export const INDEXES = {
  reviewIndex: process.env.GSI_REVIEW_INDEX || "review-index",
  phoneIndex: process.env.GSI_PHONE_INDEX || "phone-index",
  audienceIndex: process.env.GSI_AUDIENCE_INDEX || "audience-index",
};

export const QUEUE_URL = process.env.SQS_QUEUE_URL || "";

export const SCHEDULES = {
  weeklySms: process.env.SCHEDULE_WEEKLY_SMS || "smart-weekly-sms",
  weeklySmsPrecheck:
    process.env.SCHEDULE_WEEKLY_SMS_PRECHECK || "smart-weekly-sms-precheck",
  weeklyPush: process.env.SCHEDULE_WEEKLY_PUSH || "smart-weekly-push",
};

export const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN || "";
export const LAMBDA_ARNS = {
  weeklySms: process.env.WEEKLY_SMS_LAMBDA_ARN || "",
  weeklyPrecheck: process.env.WEEKLY_PRECHECK_LAMBDA_ARN || "",
  sendPush: process.env.SEND_PUSH_LAMBDA_ARN || "",
};
export const SEND_PUSH_FUNCTION_NAME =
  process.env.SEND_PUSH_FUNCTION_NAME || "smart-sendPush";

export const EC2_API_BASE = process.env.EC2_API_BASE || "";
export const EC2_API_TOKEN = process.env.EC2_API_TOKEN || "";

export const SETTINGS_PK = "SETTINGS";
