# CLAUDE.md — lambdas

Lambda source (TypeScript, bundled by the CDK `NodejsFunction` in `../infra`).
`@aws-sdk/*` is provided by the Node 20 runtime (marked external); `firebase-admin`
and `uuid` are bundled.

## Handlers (`src/<name>/index.ts`)
| Lambda | Trigger | Does |
|---|---|---|
| `appointmentWebhook` | API GW `POST /webhook/appointment?token=` | validate shared secret (header OR `?token=`); upsert customer (name split, phone→E.164, `employeeId` coerced to string); new → enqueue welcome (one-time); existing → update visit fields only |
| `reviewsAutomation` | EventBridge rate 10m | query `review-index` (sentReview=0 AND lastAppointmentEnd<=now, exclude unsub); render (שם_פרטי/שם_הספר); mark sentReview=1 (conditional); enqueue |
| `weeklySmsAutomation` | EventBridge cron | `selectWeeklyRecipients` (audience+days via GSI); balance safety-check via EC2; enqueue with batchId |
| `weeklyPrecheck` | cron (weekly −1h) | same recipient count; if balance < count → alert `notifyLowBalance` employees |
| `balanceMonitor` | rate 1h | EC2 balance < threshold → one alert (cooldown `runtime.lowBalanceAlerted`) |
| `sendPush` | scheduler `{trigger:"weekly"}` or manual `{title,body}` | FCM **topic `all`** via firebase-admin; writes `runtime.lastPushSentAt` |

## Shared (`src/shared/`)
- `ddb.ts` — Doc client; `TABLES`, `INDEXES` (incl. `audienceIndex`).
- `customers.ts` — `queryReviewDue`, **`selectWeeklyRecipients`** (audience-index GSI: PK unsubscribe="0", SK lastVisitAt range; audience=active/stopped/inactive via activeMonths+inactiveMonths; days EXCLUDES recent).
- `settings.ts` — typed `getSettings(group)`; `AudienceSettings` = {activeMonths, inactiveMonths}.
- `sqs.ts` — `enqueueSms` (batch 10); `SmsJob {to,body,dedupKey,source,batchId?}`.
- `vars.ts` — `renderMessage` (שם_פרטי/שם_משפחה/שם_הספר/שם_משפחה_ספר; order matters).
- `phone.ts` — `normalizeIsraeliPhone` → +9725XXXXXXXX.
- `dates.ts` — parse `dd/MM/yyyy HH:mm` as Asia/Jerusalem → ISO UTC; `jerusalemDateKey`.
- `alerts.ts` — operational alerts to `notifyLowBalance` employees (NOT filtered by unsubscribe; per-day dedup).
- `ec2.ts` — `getSmsBalance()` via EC2 `/balance` (Lambdas aren't IP-whitelisted).
- `secrets.ts` — cached secret fetch.

## Notes
- Keep `lambdas/src/shared/customers.ts` audience logic **in sync** with `web/src/lib/customers.ts`.
- The SQS **worker lives on EC2** (not a Lambda) — it's the single writer of `smart-sms-activity-log`.
- Build check: `npm run typecheck`. Deploy: via `cd ../infra && cdk deploy`.
