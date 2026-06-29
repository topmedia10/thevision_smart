# CLAUDE.md — web (Next.js admin)

Next.js 15 (App Router, TS) + Tailwind, **Hebrew RTL, dark SaaS theme**. Hosted on
Vercel (root dir `web`, auto-deploys on push to `main`). All AWS calls are
**server-side only** (server actions / RSC) via the `smart-vercel` IAM user.

## Layout
- `src/app/layout.tsx` — RTL `<html dir=rtl>`, Heebo font. `globals.css` — dark theme + component classes (`.card`, `.btn-*`, `.input`, `.label`, `.toolbtn`, `.info-bar`, `.chip`, `.muted/.faint`) using CSS vars.
- `src/app/login/` — phone→OTP (iron-session).
- `src/app/(admin)/` — protected group (`layout.tsx` calls `requireAdmin`, renders `Sidebar`): dashboard `page.tsx`, `sms/` (+`saved/`), `report/`, `push/`, `automation/{welcome,reviews,weekly-sms,weekly-push}/`, `employees/`, `settings/`.
- `src/app/unsubscribe/` — public, reCAPTCHA v2 checkbox.
- `src/components/` — `SmsTextarea` (§9 component), `PhonePreview` (dark SMS mock), `PushPreview` (lock-screen mock + app icon), `SendSmsForm`, `AutomationForms`, `EmployeesManager`, `SavedManager`, `SettingsForm`, `PushForm`, `Sidebar`.
- `src/lib/` — `auth.ts` (OTP + `requireAdmin`, sha256 hashes + iron-session), `session.ts`, `aws/clients.ts`, `customers.ts` (audience-index GSI queries), `settings.ts`, `employees.ts`, `savedMessages.ts`, `sqs.ts`, `scheduler.ts` (UpdateSchedule + −1h precheck rollover), `lambda.ts` (invoke sendPush), `ec2.ts` (balance/OTP), `vars.ts`, `phone.ts`, `format.ts` (Asia/Jerusalem), `stats.ts`, `constants.ts`, `nav.ts`.

## Key behaviors
- **Audience/days/employee filtering** → `src/lib/customers.ts` queries `audience-index` (PK unsubscribe="0", SK lastVisitAt range from audience+days; employeeId FilterExpression). Excludes unsubscribed inherently. Days filter EXCLUDES recent visitors. Keep in sync with `lambdas/src/shared/customers.ts`.
- **Live recipient count**: `countManualAction` / `countWeeklyAction` (debounced) power the live `.info-bar` on SMS-send + weekly-SMS pages.
- **Schedules**: saving weekly-SMS updates `smart-weekly-sms` + `smart-weekly-sms-precheck` (−1h, day rollover); weekly-push updates `smart-weekly-push`.
- **Push**: PushForm/WeeklyPushForm invoke sendPush (topic). Preview uses the app icon image.
- Dates rendered via `format.ts` (Asia/Jerusalem).

## Commands & env
```bash
npm install
SESSION_SECRET=<32+ chars> npm run build   # or npm run dev
```
Env vars: see `.env.example` and `docs/ENV.md`. reCAPTCHA: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (v2 checkbox) + `RECAPTCHA_SECRET_KEY`.

## Gotchas
- Server-only modules import `"server-only"`; never expose AWS creds/secrets to client.
- After deleting a route, stale `.next/types` can make `tsc` complain — a fresh `npm run build` regenerates them.
- The settings `audience` group has only `activeMonths` + `inactiveMonths` (stoppedMonths removed).
