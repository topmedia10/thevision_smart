# Conventions — single source of truth

All code is **English**. Admin UI copy is **Hebrew (RTL)**. Region: `il-central-1`.
Timezone for all schedules: `Asia/Jerusalem`.

## Resource names

Defined once in `infra/lib/constants.ts`. Apps never hardcode these — they read the
actual names from environment variables (set from CDK outputs at deploy/config time).

| Logical | Physical name | Notes |
|---|---|---|
| Stack | `TheVisionSmartStack` | |
| Customers table | `smart-customers` | PK `phone` (E.164). GSI `review-index` (PK `sentReview`, SK `lastAppointmentEnd`) |
| Employees table | `smart-employees` | PK `employeeId`. GSI `phone-index` (PK `phone`) |
| Settings table | `smart-settings` | PK `SETTINGS`, SK = group |
| SavedMessages table | `smart-saved-messages` | PK `id` |
| SmsActivityLog table | `smart-sms-activity-log` | PK `LOG`, SK `sentAt#id` |
| SmsIdempotency table | `smart-sms-idempotency` | PK `dedupKey`, TTL `ttl` (~7 days) |

> Note: push now uses FCM **topic `all`** — the device-token registry table and
> `/devices/register` endpoint were removed. Customers also have GSI
> `audience-index` (PK `unsubscribe`, SK `lastVisitAt`) for audience filtering.
| Main queue | `sms-outbox` | |
| DLQ | `sms-outbox-dlq` | maxReceiveCount 4 |

### Lambdas
`appointmentWebhook`, `reviewsAutomation`, `weeklySmsAutomation`, `weeklyPrecheck`,
`balanceMonitor`, `sendPush`, `registerDevice`.

### EventBridge schedules
| Name | Type | Source | Editable |
|---|---|---|---|
| `smart-reviews` | `rate(10 minutes)` | fixed | no |
| `smart-weekly-sms` | cron | `weeklySms.dayOfWeek`+`time` | yes (from UI) |
| `smart-weekly-sms-precheck` | cron | weekly-sms time − 60m (day rollover) | yes (with weekly-sms) |
| `smart-weekly-push` | cron | `weeklyPush.dayOfWeek`+`time` | yes (from UI) |
| `smart-balance-monitor` | `rate(1 hour)` | fixed | no |

### Secrets Manager
| Name | Used by | Contents |
|---|---|---|
| `smart/global-sms` | EC2 only | `{ "apiKey": "...", "originator": "..." }` |
| `smart/ec2-api-token` | EC2 + Lambdas + Vercel | bearer token string |
| `smart/webhook-secret` | API GW webhook + booking source | shared secret string |
| `smart/firebase-service-account` | sendPush Lambda only | Firebase service-account JSON |

## SQS message shape (one message = one SMS)
```json
{ "to": "+9725XXXXXXXX", "body": "rendered text", "dedupKey": "...", "source": "manual|welcome|review|weekly|otp|test|alert" }
```

## Dedup key conventions
- Welcome:  `welcome#<phone>#<createDate>`
- Review:   `review#<phone>#<lastAppointmentEnd>`
- Weekly:   `weekly#<phone>#<yyyy-mm-dd>`
- Manual:   `manual#<batchId>#<phone>`
- Alert:    `alert#<kind>#<employeePhone>#<yyyy-mm-dd>`  (kind = precheck|threshold|weeklysafety)

## Phone normalization → E.164 Israel (`+9725XXXXXXXX`)
Strip non-digits. `0XXXXXXXXX` → `+972` + drop leading 0. `972...` → `+972...`.
Already `+972...` → unchanged. Reject anything that doesn't resolve to a valid IL mobile.

## Variable replacement (server-side, before queuing each message)
| Token (Hebrew) | Value |
|---|---|
| `שם_פרטי` | customer first name |
| `שם_משפחה` | customer last name |
| `שם_הספר` | employee first name (Employees by customer.employeeId) |
| `שם_משפחה_ספר` | employee last name |

Operational employee alerts (precheck / threshold / weekly-safety) do **not** substitute
customer variables.

## Settings groups (SK values) and shapes
See `infra/lib/constants.ts` `SETTINGS_GROUPS` and `docs/DATA_MODEL.md`.

## Compliance
Every marketing send (reviews, weekly, manual) excludes `unsubscribe != "0"`.
Welcome (transactional) and OTP are exempt. Operational alerts to employees are
**not** filtered by unsubscribe. Israeli anti-spam: marketing SMS should carry
"פרסומת", identify the business, and include opt-out (UI surfaces a non-blocking reminder).

## Environment variables (names; values from Secrets/CDK outputs)
See `docs/ENV.md`.
