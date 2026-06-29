# CLAUDE.md — ec2

Two Node/TypeScript services on the existing EC2 (`i-08b5b54881a151608`, Amazon
Linux 2023, EIP `51.84.169.45`). Managed entirely via **AWS SSM** (no SSH).

## Services (systemd)
- `thevision-smart-api` → `dist/server.js`: Express API on `127.0.0.1:8080`.
  - `GET /health` (no auth), `GET /balance` (bearer), `POST /send-otp` (bearer).
- `thevision-smart-worker` → `dist/worker.js`: long-polls SQS `sms-outbox`, sends via Global SMS, idempotency (`smart-sms-idempotency`), writes `smart-sms-activity-log` (one row per sent message), DLQ after retries, inter-send delay.
- `nginx` reverse-proxies `api.thevision.co.il` (443, **Cloudflare Origin Cert** at `/etc/ssl/cloudflare/origin.{pem,key}`) → 8080.

## Source (`src/`)
- `globalSms.ts` — **SOAP** client for `WsSMS.asmx` (namespace `apiGlobalSms`): `getBalance` (ApiKey) and `sendSmsToRecipients` (ApiKey/txtOriginator/destinations/txtSMSmessage/dteToDeliver/txtAddInf). The REST API returns IIS 403 on this account — DO NOT use it.
- `config.ts` — all from env (`/etc/thevision-smart.env`); Global SMS creds optional so services boot before the secret is filled.
- `api.ts`/`server.ts` — Express app (constant-time bearer check). `worker.ts` — SQS loop. `ddb.ts` — idempotency + activity log. `logger.ts` — JSON logs.

## Deploy / ops (via SSM `AWS-RunShellScript`)
- Code is delivered as a base64 tarball over SSM, extracted to `/opt/thevision-smart`, then `setup/install.sh` runs (`npm ci`, `npm run build`, writes env from Secrets Manager, **`systemctl restart`** both services, configures nginx).
- Env file `/etc/thevision-smart.env` (mode 600) is generated from secrets `smart/ec2-api-token` + `smart/global-sms`.
- Runbook (full commands, DNS, certbot-vs-Cloudflare, secret rotation): `setup/RUNBOOK.md`.

## Gotchas
- `install.sh` uses `systemctl restart` (NOT `enable --now`) so re-runs pick up env/secret/code changes.
- Cloudflare record for `api.thevision.co.il` is **Proxied** → use the Origin Cert (certbot HTTP-01 won't validate through the proxy). SG `sg-025c2df4f971ce7a1` allows 443 from Cloudflare IP ranges.
- The instance reaches Global SMS from the whitelisted EIP; Lambdas call `/balance` here instead (no whitelisted IP).
