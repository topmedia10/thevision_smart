/**
 * Configuration is read entirely from environment variables (loaded by systemd
 * from /etc/thevision-smart.env). Secrets are never hardcoded.
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  region: process.env.AWS_REGION || "il-central-1",
  port: Number(process.env.PORT || 8080),

  // Auth for the EC2 HTTP API (clients send `Authorization: Bearer <token>`).
  apiToken: req("EC2_API_TOKEN"),

  // Global SMS — not hard-required so the services can boot before the
  // (compromised) key is rotated and the secret populated. Calls return a
  // clear error while these are empty.
  globalSms: {
    host: process.env.GLOBAL_SMS_HOST || "http://api.itnewsletter.co.il",
    apiKey: process.env.GLOBAL_SMS_API_KEY || "",
    originator: process.env.GLOBAL_SMS_ORIGINATOR || "",
  },

  // AWS resources
  queueUrl: req("SQS_QUEUE_URL"),
  tables: {
    smsIdempotency: req("TABLE_SMS_IDEMPOTENCY"),
    smsActivityLog: req("TABLE_SMS_ACTIVITY_LOG"),
  },

  // Worker tuning
  interSendDelayMs: Number(process.env.INTER_SEND_DELAY_MS || 80),
  idempotencyTtlDays: Number(process.env.IDEMPOTENCY_TTL_DAYS || 7),
};
