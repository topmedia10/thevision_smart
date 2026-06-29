# CLAUDE.md — infra (AWS CDK)

AWS CDK (TypeScript) provisioning the entire backend in `il-central-1`.

## Layout
- `bin/infra.ts` — app entry (account from `CDK_DEFAULT_ACCOUNT`, region from constants).
- `lib/constants.ts` — **single source of truth** for resource names, GSIs, queues, lambda names, schedule names, secret names, settings groups, SmsJob shape.
- `lib/thevision-smart-stack.ts` — the whole stack.

## What it creates
- **DynamoDB** (PAY_PER_REQUEST, RETAIN, PITR): `smart-customers` (GSIs: `review-index` PK sentReview/SK lastAppointmentEnd, `audience-index` PK unsubscribe/SK lastVisitAt), `smart-employees` (GSI `phone-index`), `smart-settings`, `smart-saved-messages`, `smart-sms-activity-log`, `smart-sms-idempotency` (TTL `ttl`).
- **SQS**: `sms-outbox` (+ DLQ, maxReceive 4).
- **Secrets**: `smart/global-sms`, `smart/ec2-api-token` (auto-gen), `smart/webhook-secret` (auto-gen), `smart/firebase-service-account`.
- **Lambdas** (NodejsFunction, Node 20, esbuild, `@aws-sdk/*` external): appointmentWebhook, reviewsAutomation, weeklySmsAutomation, weeklyPrecheck, balanceMonitor, sendPush (bundles firebase-admin, 120s). Entries in `../lambdas/src/<name>/index.ts`.
- **API Gateway HTTP API** `smart-public`: `POST /webhook/appointment` (device registration route was removed).
- **EventBridge Scheduler**: `smart-reviews` (rate 10m), `smart-balance-monitor` (rate 1h), `smart-weekly-sms` / `smart-weekly-sms-precheck` / `smart-weekly-push` (cron, editable from the app via UpdateSchedule).
- **IAM**: per-Lambda least-priv grants; `smart-ec2-role` + instance profile (attach to the EC2 manually); `smart-scheduler-role`; `smart-vercel` user + **customer-managed** policy `smart-vercel-policy` (wildcard `table/smart-*`, SQS send, invoke sendPush, read 2 secrets, Get/UpdateSchedule on the 3 editable schedules, PassRole scheduler).

## Commands
```bash
npm install
CDK_DEFAULT_ACCOUNT=975050130305 npx cdk synth
CDK_DEFAULT_ACCOUNT=975050130305 npx cdk deploy --require-approval never
```
Outputs are written to `cdk-outputs.json` (gitignored).

## Gotchas
- **Vercel user policy must be a customer-managed policy**, not inline (inline user policy 2 KB limit overflows). Already done.
- Adding a GSI is online but DynamoDB allows **one GSI add per update** — don't add two GSIs in a single deploy.
- Tables are RETAIN: a failed *initial* create orphans them → delete orphans + the ROLLBACK_COMPLETE stack before redeploy.
- The EC2 instance profile is created here but **attached manually** (`aws ec2 associate-iam-instance-profile`), since CDK doesn't own the instance.
