# The Vision — "Smart" (סמארט) · SMS & Push Marketing Automation

Hebrew (RTL) admin panel + AWS automation backend for SMS (Global SMS) and push
(Firebase Cloud Messaging) marketing for a hair-salon business.

> **Code, infra, comments → English. Admin UI copy → Hebrew (RTL).**
> Region `il-central-1` · Timezone `Asia/Jerusalem`.

## Monorepo layout

| Path | What |
|---|---|
| `infra/` | AWS CDK (TypeScript) — DynamoDB, SQS, Lambdas, API Gateway, EventBridge, Secrets, IAM |
| `lambdas/` | Lambda source — webhook, automations, push, device registration + shared libs |
| `ec2/` | EC2 services — HTTP API (`/balance`, `/send-otp`) + SQS worker + Global SMS client (TODO) |
| `web/` | Next.js admin panel + unsubscribe page (TODO) |
| `docs/` | `CONVENTIONS.md`, `ENV.md`, `DATA_MODEL.md`, runbooks, open-items checklist |

## Security model (read first)

- **Global SMS API key lives ONLY on EC2** (Secrets Manager `smart/global-sms`).
  Never in the Next.js repo, Vercel, or GitHub. The previously-shared key is
  **compromised — rotate it with Global SMS before go-live.**
- **Firebase service-account JSON lives ONLY in the `sendPush` Lambda**
  (`smart/firebase-service-account`).
- Next.js never calls Global SMS directly — it calls the EC2 API over HTTPS with
  a bearer token (`smart/ec2-api-token`).
- All public endpoints are authenticated/abuse-protected (shared secret /
  reCAPTCHA / throttling). Auth cookies are `httpOnly` `Secure` `SameSite`,
  encrypted via iron-session.

## Build status — LIVE

- [x] Monorepo scaffold + conventions
- [x] CDK stack deployed (`il-central-1`)
- [x] Lambdas deployed + integration-tested (webhook, reviews, weekly, push, balance)
- [x] EC2 services live (API + SQS worker + Global SMS **SOAP** client; HTTPS via Cloudflare Origin Cert)
- [x] Next.js admin live at `smart.thevision.co.il` (dark RTL) + unsubscribe page
- [x] Docs: per-part `CLAUDE.md`, RN FCM guide, open-items checklist

**Start here:** [CLAUDE.md](CLAUDE.md) (master reference) ·
[docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md) (what's left / your inputs) ·
per-part docs in `infra/`, `lambdas/`, `ec2/`, `web/`.

> Push uses **FCM topics** (the device-token registry was removed). SMS uses the
> Global SMS **SOAP** API. Audience filtering uses the `audience-index` GSI.

## Deploy (high level)

See `docs/RUNBOOK.md` (TODO) for full steps. Summary:

```bash
# 1. CDK
cd infra
npm install
CDK_DEFAULT_ACCOUNT=975050130305 npx cdk bootstrap   # once per account/region
CDK_DEFAULT_ACCOUNT=975050130305 npx cdk deploy

# 2. Fill secrets (see docs/ENV.md), attach EC2 instance profile, set up EC2
# 3. Deploy Next.js to Vercel, configure DNS
```

All DynamoDB tables use `RemovalPolicy.RETAIN` and point-in-time recovery — the
stack will never delete customer data on teardown.
