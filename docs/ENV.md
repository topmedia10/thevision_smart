# Environment variables

Never commit real values. Secrets live in AWS Secrets Manager; the apps read
names/ARNs and fetch at runtime. Resource names come from CDK outputs.

## EC2 instance (`/etc/thevision-smart.env`, loaded by systemd)
| Var | Source | Notes |
|---|---|---|
| `AWS_REGION` | `il-central-1` | |
| `EC2_API_TOKEN` | secret `smart/ec2-api-token` | bearer token clients must send |
| `GLOBAL_SMS_API_KEY` | secret `smart/global-sms` → `apiKey` | **rotate before go-live** |
| `GLOBAL_SMS_ORIGINATOR` | secret `smart/global-sms` → `originator` | approved sender ID |
| `GLOBAL_SMS_HOST` | `http://api.itnewsletter.co.il` | HTTP only (provider requirement) |
| `SQS_QUEUE_URL` | CDK output `SqsQueueUrl` | |
| `TABLE_SMS_IDEMPOTENCY` | `smart-sms-idempotency` | |
| `TABLE_SMS_ACTIVITY_LOG` | `smart-sms-activity-log` | |
| `TABLE_EMPLOYEES` | `smart-employees` | OTP / session |
| `INTER_SEND_DELAY_MS` | `80` | rate-limit spacing |

## Lambdas (set by CDK)
`TABLE_*`, `GSI_*`, `SQS_QUEUE_URL`, `TZ=Asia/Jerusalem`, plus per-function
`WEBHOOK_SECRET_ARN`, `EC2_API_BASE`, `EC2_API_TOKEN_ARN`, `FIREBASE_SECRET_ARN`.

## Next.js / Vercel (server-side only — never `NEXT_PUBLIC_` for secrets)
| Var | Notes |
|---|---|
| `AWS_REGION` | `il-central-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | access key for IAM user `smart-vercel` |
| `TABLE_CUSTOMERS` … `TABLE_DEVICE_TOKENS` | from CDK outputs |
| `GSI_REVIEW_INDEX` / `GSI_PHONE_INDEX` | |
| `SQS_QUEUE_URL` | |
| `SEND_PUSH_FUNCTION_NAME` | `smart-sendPush` |
| `SCHEDULE_WEEKLY_SMS` / `SCHEDULE_WEEKLY_SMS_PRECHECK` / `SCHEDULE_WEEKLY_PUSH` | schedule names |
| `SCHEDULER_ROLE_ARN` | from CDK output `SchedulerRoleArn` |
| `WEEKLY_SMS_LAMBDA_ARN` / `WEEKLY_PRECHECK_LAMBDA_ARN` / `SEND_PUSH_LAMBDA_ARN` | UpdateSchedule targets |
| `EC2_API_BASE` | `https://api.thevision.co.il` |
| `EC2_API_TOKEN` | bearer token (mirror of `smart/ec2-api-token`) |
| `SESSION_SECRET` | 32+ byte random — iron-session cookie encryption |
| `RECAPTCHA_SITE_KEY` (public) / `RECAPTCHA_SECRET_KEY` | unsubscribe page |
| `TIMEZONE` | `Asia/Jerusalem` |

## React Native app
| Var | Notes |
|---|---|
| `DEVICE_REGISTER_URL` | CDK output `DeviceRegisterUrl` |
