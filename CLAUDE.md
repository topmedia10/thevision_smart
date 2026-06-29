# CLAUDE.md — The Vision "Smart" (master reference)

Hebrew (RTL) admin + AWS backend for SMS (Global SMS) & Push (FCM) marketing for
a hair-salon. **Code/infra in English, admin UI copy in Hebrew.** Region
`il-central-1`, timezone `Asia/Jerusalem`.

Each sub-project has its own `CLAUDE.md`: [infra](infra/CLAUDE.md) ·
[lambdas](lambdas/CLAUDE.md) · [ec2](ec2/CLAUDE.md) · [web](web/CLAUDE.md).
Open items / go-live checklist: [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md).

## Architecture (data flow)

```
Booking system ──POST /webhook/appointment?token=── API GW → appointmentWebhook Lambda
                                                      → upsert customer, enqueue welcome
EventBridge (rate/cron) → reviews / weeklySms / weeklyPrecheck / balanceMonitor Lambdas
                                                      → enqueue SMS jobs to SQS
Admin (Next.js, Vercel) ── server actions ──→ DynamoDB, SQS, Scheduler, Lambda(sendPush)
                       └─ balance/OTP ──HTTPS──→ EC2 API ──SOAP──→ Global SMS
SQS sms-outbox → EC2 worker → Global SMS (SOAP) → idempotency + activity log
sendPush Lambda → FCM topic "all" (firebase-admin)
```

## Where things live
| Path | What | Deploy |
|---|---|---|
| `infra/` | AWS CDK (TS) — all resources | `cd infra && cdk deploy` |
| `lambdas/` | Lambda source + shared libs | bundled by CDK on deploy |
| `ec2/` | EC2 API + SQS worker + Global SMS SOAP client | SSM (see ec2/CLAUDE.md) |
| `web/` | Next.js admin + unsubscribe | push to GitHub → Vercel auto-deploy |
| `docs/` | conventions, env, runbook, RN guide, open items | — |

## Live state (as of last work)
- **CDK stack `TheVisionSmartStack`** deployed; account `975050130305`, region `il-central-1`.
- **EC2** `i-08b5b54881a151608` (EIP `51.84.169.45`) runs API+worker+nginx; HTTPS via Cloudflare Origin Cert at `api.thevision.co.il`.
- **Admin** live at `smart.thevision.co.il` (Vercel project `thevision-smart`, team `bryan-topmediaclis-projects`, root dir `web`, auto-deploys on push to `main` @ `github.com/topmedia10/thevision_smart`).
- **Global SMS**: uses the **SOAP** API (`WsSMS.asmx`) — NOT REST (REST returns 403). Key + originator (`TheVision`) in Secrets Manager `smart/global-sms`. Verified working (balance + send).
- **Push**: FCM **topic `all`** (token registry was removed). Firebase service-account in `smart/firebase-service-account`. App subscribes via `subscribeToTopic('all')`.
- First admin user: בריאן אורלנד / `+972505862107` / employeeId `43795`.

## Key decisions / gotchas (read before changing things)
- **SMS = SOAP, not REST.** `ec2/src/globalSms.ts` builds SOAP envelopes.
- **Push = FCM topic** (no device table / no /devices/register — those were removed).
- **Audience** ("קהל לקוחות") uses 2 thresholds from settings `audience`: `activeMonths`, `inactiveMonths`. active = visited within activeMonths; stopped = between active & inactive; inactive = older than inactive. Based on `lastVisitAt`.
- **Audience/days/employee filtering** uses the **`audience-index` GSI** (PK `unsubscribe`, SK `lastVisitAt`): query PK="0" (excludes unsubscribed) + lastVisitAt range (audience + days) + employeeId FilterExpression. See `web/src/lib/customers.ts` and `lambdas/src/shared/customers.ts` (keep them in sync).
- **Days filter EXCLUDES recent visitors**: filterDays=N removes anyone with `lastVisitAt` within the last N days (0 = no day filter).
- **Reviews & welcome are one-time** (`sentReview`/`sentWelcome` "0"/"1"). Webhook never resets them for existing customers.
- **All dates** stored ISO-UTC; webhook parses `dd/MM/yyyy HH:mm` as Asia/Jerusalem; UI formats via `web/src/lib/format.ts` with `timeZone: Asia/Jerusalem`.
- **Tables are RETAIN** — a failed initial `cdk deploy` orphans tables; delete them before redeploy.
- **EC2 deploys via SSM** (no SSH); `ec2/setup/install.sh` uses `systemctl restart`.

## Conventions
Resource names: `infra/lib/constants.ts`. Env var names: `docs/ENV.md`.
Dedup keys, SQS job shape, variable tokens: `docs/CONVENTIONS.md`.
