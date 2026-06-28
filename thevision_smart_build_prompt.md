# Build Prompt — "Smart" (The Vision) SMS & Push Marketing Automation System

You are a senior full-stack + AWS engineer. Build the complete system described below. The **admin UI must be in Hebrew (RTL)**; all code, comments, variable names, and infra must be in English. Work end-to-end: provision AWS, build the EC2 services, the Lambdas, the DynamoDB model, the Next.js admin panel, the FCM push integration, and give me exact, copy-paste instructions for everything I must do manually (DNS, Vercel, Firebase, the React Native app, IAM keys).

Ask me before destroying or overwriting anything in my AWS account. Never hardcode secrets — read everything from environment variables / AWS Secrets Manager. Produce Infrastructure-as-Code (AWS CDK in TypeScript preferred; CloudFormation acceptable) so the whole stack is reproducible, plus a clear README.

---

## 0. CRITICAL — Secrets & security (do this first)

- The Global SMS `ApiKey` was previously written in plaintext in my spec. **Treat it as compromised.** Use a placeholder everywhere and remind me in the README to rotate it with Global SMS before going live.
- The Global SMS API key lives **only on the EC2 instance** (env / Secrets Manager). It must NEVER exist in the Next.js repo, in Vercel, or in GitHub. The Next.js app never calls Global SMS directly — it only calls the EC2 server (balance, OTP) over HTTPS with its own auth token.
- The Firebase service-account JSON lives **only in the push Lambda** (via Secrets Manager). It must NOT be on Vercel.
- All public endpoints (webhook, device registration, unsubscribe) must be authenticated or abuse-protected (shared secret / reCAPTCHA / throttling).
- Auth cookies must be `httpOnly`, `Secure`, `SameSite`, and signed/encrypted (use `iron-session` or signed JWT). Never store raw secrets in a readable cookie.

---

## 1. Tech stack & resources

- **Region (all AWS resources):** `il-central-1` (Tel Aviv). Schedules use timezone `Asia/Jerusalem`.
- **Admin panel:** Next.js (App Router, TypeScript), hosted on Vercel, repo `https://github.com/topmedia10/thevision_smart.git`, domain `smart.thevision.co.il`. Hebrew RTL UI. The unsubscribe page lives in the same Next.js project.
- **Database:** Amazon DynamoDB.
- **Queue:** Amazon SQS (with a Dead-Letter Queue).
- **Compute:** existing EC2 instance `i-08b5b54881a151608` with a static Elastic IP (whitelisted at Global SMS). Nothing is installed on it yet — install everything. Use AWS Lambda for the automations and the webhook.
- **Scheduling:** Amazon EventBridge Scheduler.
- **Public entry:** Amazon API Gateway (HTTP API) for the appointment webhook and device registration.
- **Push:** Firebase Cloud Messaging, project `thevision-a496b` (currently empty; build as if the apps are already wired). Server side uses the Firebase Admin SDK.
- **SMS provider:** Global SMS. API host `api.itnewsletter.co.il` over **HTTP** (their requirement — keep HTTP only for the outbound call to them; everything customer-facing is HTTPS).

---

## 2. Global SMS API (confirmed from sample files)

**Check balance** — `GET http://api.itnewsletter.co.il/api/restApiSms/getBalance?ApiKey=<key>`
- Returns the remaining balance as plain text (a number). Error strings include `invalid login` and `e 1`. HTTP 401/403 means the server IP is not whitelisted.

**Send SMS** — `POST http://api.itnewsletter.co.il/api/restApiSms/sendSmsToRecipients`, JSON body:
```json
{ "ApiKey": "<key>", "txtOriginator": "<approved sender>", "destinations": "<phone>", "txtSmsMessage": "<text>" }
```
- On success returns a numeric value = credits charged. On failure returns a text error. Handle at least: `invalid login` (bad key), `Unapporved originator number` (sender not approved / KYC), `Not enough credit`.
- `txtOriginator` (approved sender ID) is a config value — put it in EC2 env (`GLOBAL_SMS_ORIGINATOR`). I will provide the approved value.

Implement a small SMS client module on EC2 wrapping both calls with robust error handling (network errors, non-200, text-error parsing) and structured logging.

---

## 3. Data model (DynamoDB)

Normalize all phone numbers to canonical E.164 Israeli format (`+9725XXXXXXXX`) before storing or comparing. Use that as keys.

**Customers** — PK `phone` (E.164).
- `firstName`, `lastName`, `phone`, `employeeId`
- `lastAppointmentEnd` (ISO; = appointment EndDate **plus** the reviews-automation `delayMinutes` from settings) — drives review timing
- `lastVisitAt` (ISO; the raw EndDate) — drives audience filtering
- `sentWelcome` ("0"/"1"), `sentReview` ("0"/"1")
- `unsubscribe` ("0" or ISO timestamp), `unsubscribeIp`
- `createdAt`, `updatedAt`
- **GSI `review-index`**: PK `sentReview`, SK `lastAppointmentEnd` — to query `sentReview="0"` AND `lastAppointmentEnd <= now`.

**Employees** — PK `employeeId`.
- `firstName`, `lastName`, `phone`, `employeeId`
- `admin` (bool), `showInSms` (bool), `notifyLowBalance` (bool)
- `otpHash`, `otpExpiresAt`, `otpAttempts` (login flow)
- `sessionTokenHash`, `sessionExpiresAt` (session)
- **GSI `phone-index`**: PK `phone` — for login lookup.

**Settings** — PK `SETTINGS`, SK per group: `business`, `welcome`, `reviews`, `weeklySms`, `weeklyPush`, `audience`, `alerts`, `runtime`.
- `business`: businessName, businessAddress, bookingLink, googleReviewLink, smsUnsubscribeLink
- `welcome`: enabled (bool), message
- `reviews`: enabled (bool), delayMinutes (0–99), message
- `weeklySms`: enabled (bool), dayOfWeek (0–6), time ("HH:mm"), filterDays (1–10), message
- `weeklyPush`: enabled (bool), dayOfWeek, time, title, body
- `audience`: activeMonths, stoppedMonths, inactiveMonths (1–12 each)
- `alerts`: `weeklyPrecheckMessage` (sent to flagged employees when the pre-weekly balance check finds insufficient credit, see §6.6), `lowBalanceThreshold` (number, e.g. 200), `lowBalanceMessage` (sent to flagged employees when balance drops below the threshold, see §6.7)
- `runtime`: lastPushCount, lastPushSentAt, lastManualSms snapshot (for "remember last send" defaults), `lowBalanceAlerted` (bool — cooldown flag so the threshold alert fires once per crossing, not every check)

**SavedMessages** — PK `id` (uuid): `title`, `body`, `createdAt`.

**SmsActivityLog** — PK `LOG`, SK `sentAt#id`: `message`, `sentAt`, `recipientsCount`, `credits`, `source` (`manual|welcome|review|weekly|otp|test`), `status`.

**DeviceTokens** — PK `token`: `platform` (`ios|android`), `createdAt`, `lastSeen`. (Powers push send + the "how many were sent" count.)

**SmsIdempotency** — PK `dedupKey`: `createdAt`, `ttl` (DynamoDB TTL ~7 days). Used to guarantee a given message is sent once even though SQS is at-least-once.

Dedup key conventions: `welcome#<phone>#<createDate>`, `review#<phone>#<lastAppointmentEnd>`, `weekly#<phone>#<yyyy-mm-dd>`, `manual#<batchId>#<phone>`.

---

## 4. EC2 server (install from scratch)

Two responsibilities, both in English code (Node.js/TypeScript with a small Express app, or your preferred stack). Provision under `systemd` so both survive reboot. Put HTTPS in front via nginx + certbot (Let's Encrypt) on a subdomain I'll point at the Elastic IP, e.g. `api.thevision.co.il`. Protect every endpoint with a bearer token compared against `EC2_API_TOKEN` in env.

**(a) HTTP API**
- `GET /balance` → validates token → calls Global SMS getBalance → returns `{ ok: true, balance }` or `{ ok: false, error }`.
- `POST /send-otp` → validates token → body `{ phone, message }` → sends one SMS via Global SMS synchronously (used for login OTP) → returns success/credits or error. (Synchronous so login is fast; does not go through SQS.)

**(b) SQS worker** (long-running, long-polling):
- Receive messages (each = one SMS: `{ to, body, dedupKey, source }`).
- Idempotency: if `dedupKey` already marked sent in `SmsIdempotency`, delete the message and skip.
- Send via Global SMS. On success: write the idempotency record + an activity log entry, then delete the SQS message. On failure: do NOT delete (let visibility timeout re-deliver); after N receives it lands in the DLQ.
- Respect a configurable inter-send delay (e.g. 60–100 ms) to stay under Global SMS rate limits.

---

## 5. SQS

- One main queue `sms-outbox` + DLQ `sms-outbox-dlq` (maxReceiveCount 4).
- Visibility timeout sized to the worker's send time + buffer.
- Producers: the webhook Lambda, the automation Lambdas, and the Next.js server (manual / test sends) via `SendMessage` / `SendMessageBatch`.

---

## 6. Automations

### 6.1 Appointment webhook → Welcome (event-driven, immediate)
API Gateway `POST /webhook/appointment` → `appointmentWebhook` Lambda. Validate a shared secret header. Body (JSON) fields: `CustomerFullName, CustomerPhone, SelectedServices, StartDate, EndDate, CreateDate, Duration, ByCustomer, BusinessName, BusinessId, Source, EmployeeName, EmployeeId` (dates `dd/MM/yyyy HH:mm`).

Logic:
1. Normalize phone. Split `CustomerFullName` → `firstName` = first token, `lastName` = the rest.
2. Look up customer by phone.
3. **New customer:** create record. `lastAppointmentEnd` = EndDate + `reviews.delayMinutes`; `lastVisitAt` = EndDate; `employeeId` = EmployeeId; `sentWelcome="0"`, `sentReview="0"`.
   - If `welcome.enabled`: run variable replacement on the welcome message, enqueue it to SQS immediately (dedup `welcome#...`), set `sentWelcome="1"`.
   - If `welcome.enabled` is false: set `sentWelcome="1"` anyway (so it won't fire retroactively if later enabled) and enqueue nothing.
4. **Existing customer:** update `employeeId`, `lastAppointmentEnd` (= new EndDate + delay), and `lastVisitAt` (= new EndDate). **Do NOT touch `sentWelcome` or `sentReview`.** Both the welcome and the review are strictly one-time: a customer receives the review request only once, after their first appointment, and never again on subsequent visits.

### 6.2 Reviews (periodic Lambda)
EventBridge Scheduler fixed `rate(10 minutes)` → `reviewsAutomation` Lambda.
1. If `reviews.enabled` is false → stop.
2. Query `review-index` for `sentReview="0"` AND `lastAppointmentEnd <= now`. Filter out `unsubscribe != "0"`. If none → stop.
3. For each: variable-replace the review message, enqueue to SQS (dedup `review#...`), set `sentReview="1"`.

### 6.3 Weekly SMS (scheduled Lambda)
EventBridge Scheduler cron from `weeklySms.dayOfWeek` + `time` (Asia/Jerusalem) → `weeklySmsAutomation` Lambda.
1. If `weeklySms.enabled` false → stop.
2. Select customers where `lastVisitAt < now - weeklySms.filterDays` AND `unsubscribe="0"`.
3. Final safety check: call the EC2 `/balance` endpoint (Lambda has no whitelisted IP, so it must go through EC2). If balance < recipients → send `alerts.weeklyPrecheckMessage` (via SQS) to employees with `notifyLowBalance=true` and stop (avoid a partial send).
4. Else variable-replace per customer, enqueue all to SQS, write an activity log summary.

### 6.4 Weekly Push (scheduled Lambda)
EventBridge Scheduler cron from `weeklyPush` settings → invokes the shared `sendPush` Lambda.

### 6.5 sendPush Lambda (shared by weekly + manual)
- Reads all `DeviceTokens`, sends an FCM **multicast/batch** with `weeklyPush.title/body` (or manual title/body), using the Firebase Admin SDK (service account from Secrets Manager).
- Multicast returns per-token success/failure counts → store `lastPushCount` + `lastPushSentAt` in Settings `runtime`, and prune tokens FCM reports as unregistered.
- **Note:** I chose token-registry + multicast (not topic send) specifically so the "messages sent" count is real — topic sends don't return a count.

### 6.6 Weekly-SMS balance pre-check (one hour before)
A separate EventBridge Scheduler cron that fires **exactly one hour before** the weekly-SMS time, on the matching day → `weeklyPrecheck` Lambda.
1. If `weeklySms.enabled` false → stop.
2. Compute the same recipient count as §6.3 (filter + exclude unsubscribed).
3. Call EC2 `/balance`. If balance < recipient count → send `alerts.weeklyPrecheckMessage` (via SQS) to employees with `notifyLowBalance=true`, so they have an hour to top up before the blast.
- The cron is derived from `weeklySms.dayOfWeek` + `time` minus 60 minutes. Handle midnight/day rollover correctly (e.g. a 00:30 send → a 23:30 pre-check on the previous day). This schedule must be updated together with the weekly-SMS schedule whenever I save those settings (see Schedule management).

### 6.7 Low-balance threshold monitor
A standalone EventBridge Scheduler `rate(1 hour)` → `balanceMonitor` Lambda (independent of the weekly automation).
1. Call EC2 `/balance`.
2. If balance < `alerts.lowBalanceThreshold` AND `runtime.lowBalanceAlerted` is false → send `alerts.lowBalanceMessage` (via SQS) to employees with `notifyLowBalance=true`, then set `runtime.lowBalanceAlerted = true`.
3. If balance ≥ `alerts.lowBalanceThreshold` → set `runtime.lowBalanceAlerted = false`.
- The cooldown flag guarantees employees get **one** alert when the balance crosses below the threshold, not a repeat every hour while it stays low.

### Schedule management from Next.js
When I save the weekly-SMS settings, the Next.js server (server-side only) must `UpdateSchedule` **both** the weekly-SMS schedule and its pre-check schedule (time − 1h, with day rollover). When I save the weekly-push settings, update the weekly-push schedule. Use full replacement (Get→modify→Update; timezone Asia/Jerusalem). The reviews schedule and the balance-monitor schedule are fixed and not user-editable.

Operational alert SMS (pre-check, threshold, weekly safety) go to employees and must **not** be filtered by `unsubscribe`; give each a dedup key so the same alert isn't sent twice.

---

## 7. Compliance & list hygiene (build in, don't skip)

- **Every marketing send (reviews, weekly, manual) must exclude `unsubscribe != "0"`.** Welcome (transactional, on booking) and OTP are exempt.
- Israeli anti-spam law: marketing SMS should carry the word "פרסומת", identify the business, and include an opt-out. The unsubscribe link button already exists in the message builder; surface a non-blocking reminder in the UI for the marketing automations. (I am not getting legal advice from you — flag it, I'll confirm with counsel.)

---

## 8. Next.js admin panel ("סמארט") — Hebrew, RTL

All AWS SDK calls run **server-side only** (Route Handlers / Server Actions) using an IAM user whose keys are Vercel env vars. Vercel needs: EventBridge Scheduler (Create/Get/Update/Delete), DynamoDB CRUD on the tables, `sqs:SendMessage`, and `lambda:InvokeFunction` on `sendPush`. No Global SMS key, no Firebase key on Vercel.

### 8.1 Auth (hardened version of my spec)
1. Login: employee enters phone. If an employee exists with that phone and `admin=true`, generate a 6-digit OTP, store its **hash** + 5-minute expiry on the employee, and send it via the EC2 `/send-otp` endpoint. Otherwise return a generic failure (don't reveal whether the number exists).
2. Employee enters the OTP. Verify against the hash + expiry + attempt limit (e.g. 5). On success, generate a strong random session token, store its **hash** + expiry on the employee, and set a signed `httpOnly` `Secure` `SameSite` cookie containing the employee phone + name (display only) — the authorization check is server-side against the stored token hash.
3. A reusable server-side `requireAdmin()` guard validates the session token hash + `admin=true` on every protected route/action. Use it everywhere.

### 8.2 Pages
- **מבט מהיר (Dashboard):** "ברוך הבא, <שם הספר>" from the cookie name; clearly displayed SMS balance (via EC2 `/balance`); nicely styled "כמות הודעות פוש שנשלחו בשליחה האחרונה" (from `runtime.lastPushCount`); add any other useful widgets (e.g. customers count, recent activity).
- **שליחת SMS** with a sub-menu:
  - *שליחת SMS:* right side — message content with a "הודעה שמורה" SELECT, "מסתפרים אצל" employee SELECT (only `showInSms=true`), "קהל לקוחות" SELECT (פעילים / הפסיקו להגיע / לא פעילים per audience settings), the **SMS textarea component** (§9), "סינון תורים מ-{1–10} ימים האחרונים", and buttons **שלח הודעה** / **שלח טסט**. Defaults pre-filled from the last manual send (`runtime`). Left side (desktop only) — a phone mockup live-previewing the message.
    - *שלח הודעה:* resolve the recipient list (audience + employee + filterDays, excluding unsubscribed), variable-replace **per customer**, enqueue each to SQS, write the activity log.
    - *שלח טסט:* send only to the logged-in employee's phone via SQS.
  - *הודעות שמורות:* create / edit / delete saved messages (feed the SELECT above).
  - *דוח פעילות SMS:* table of manual sends — message, date, recipients, credits.
- **שליחת פוש:** manual push with title + body → invoke `sendPush` Lambda → update `runtime`.
- **אוטומציית ברוך הבא:** enable toggle + welcome message (SMS textarea + desktop phone preview).
- **אוטומציית ביקורות:** enable toggle + "{up to 2 digits} דקות לפני שליחה" + review message (textarea + preview).
- **אוטומציית SMS שבועי:** clearly show the count of customers currently matching (`lastVisitAt < now - filterDays`); enable toggle; "כל יום {ראשון–שבת} בשעה {timepicker}"; "סינון תורים מ-{1–10}"; message (textarea + preview). On save, update the EventBridge schedule.
- **אוטומציית פוש שבועי:** enable toggle; day SELECT + timepicker; title; body. On save, update the EventBridge schedule.
- **אנשי צוות:** CRUD on Employees — firstName, lastName, phone, employeeId, toggles for גישה למערכת (`admin`), להציג בשליחת SMS (`showInSms`), התראות הטענת קרדיט (`notifyLowBalance`). The list view shows, per employee, how many customers are assigned to them.
- **הגדרות:** business details (name, address, booking link, Google review link, SMS unsubscribe link); audience definitions — פעילים = visited in last {1–12} months; הפסיקו להגיע = not visited for more than {1–12} months; לא פעילים = not visited for more than {1–12} months. Implement "הפסיקו להגיע" as a band between its threshold and the "לא פעילים" threshold so the three buckets don't overlap. Add an **התראות יתרה** section with: a number input "שלח התראה כשהיתרה יורדת מתחת ל-" (`alerts.lowBalanceThreshold`, e.g. 200); a textarea "הודעת התראת יתרה נמוכה" for the message employees receive when the balance crosses below that threshold (`alerts.lowBalanceMessage`, §6.7); and a textarea "הודעת התראה לפני שליחה שבועית" for the message employees receive when the one-hour-before check finds insufficient credit (`alerts.weeklyPrecheckMessage`, §6.6). Both textareas use the SMS textarea component; note that customer variables (שם_פרטי etc.) are not substituted in these operational employee alerts.

---

## 9. Shared component — SMS textarea

A reusable Hebrew RTL textarea component (match the provided `exemple_textarea.png` layout; I'll supply it — if absent, design a clean equivalent). Features:
- Two small align-style buttons (bottom-left) to set `direction`: RTL (default selected) and LTR.
- Character/segment counter below: `"<chars>/<segmentCap>  ההודעה תחוייב ב- <n> הודעות"`, where every 201 characters = +1 message (e.g. 202 chars → "202/402 … 2 הודעות"). Counter is normal color for 1 message, **red** once it exceeds the first message. (Actual billed credits come from the Global SMS response at send time; 201 is the UI estimate per my provider's rule.)
- Emoji picker button that inserts the chosen emoji at the cursor.
- "פנייה אישית" SELECT inserting `שם_פרטי` / `שם_משפחה`.
- "איש צוות" SELECT inserting `שם_הספר` / `שם_משפחה_ספר`.
- "קישור לקביעת תור" button inserting `קבע תור עכשיו 👇\n<bookingLink>`.
- "פרטי העסק" SELECT inserting business name / `<businessAddress> 📍`.
- "קישור לביקורת גוגל" button inserting the Google review link.
- "הסרה" button inserting `\n\nהסרה\n<smsUnsubscribeLink>`.

**Variable replacement** (applied server-side before queuing each message):
- `שם_פרטי` → customer first name
- `שם_משפחה` → customer last name
- `שם_הספר` → employee first name (from Employees by the customer's `employeeId`)
- `שם_משפחה_ספר` → employee last name (same lookup)

---

## 10. Unsubscribe page (same Next.js project, public)

Path under `smart.thevision.co.il`. Text like "אנא הזינו את מספר הטלפון הנייד שלכם לצורך הסרה מרשימת התפוצה", a phone input, Google reCAPTCHA, and a "הסרה" button. On submit: verify reCAPTCHA server-side; if a customer with that phone exists and `unsubscribe="0"`, set `unsubscribe` = current ISO timestamp and `unsubscribeIp` = visitor IP; show a success message. (Don't reveal whether the number existed if it didn't.)

---

## 11. Push / FCM + React Native app

- Set up Firebase project `thevision-a496b` server side with the Admin SDK (service account in Secrets Manager).
- Device registration endpoint: API Gateway `POST /devices/register` → `registerDevice` Lambda that upserts `{ token, platform }` into `DeviceTokens`. (Token-registry approach so push counts are accurate.)
- Give me exact, copy-paste steps to add to my existing React Native WebView app (queue-management WebView) for **both iOS and Android**: required packages, `google-services.json` (Android) and `GoogleService-Info.plist` + APNs setup (iOS), permission request, retrieving the FCM token, and POSTing it to `/devices/register` on every app open (and on token refresh). Tell me exactly what files to add/edit and what to configure in the Firebase console and Apple developer portal.

---

## 12. Deliverables

1. CDK app provisioning everything in `il-central-1`: DynamoDB tables + GSIs + TTL, SQS + DLQ, Lambdas, API Gateway routes, EventBridge schedules (reviews rate, weekly-SMS cron, weekly-SMS pre-check cron, weekly-push cron, balance-monitor rate), IAM roles (EC2 instance role, Lambda roles, Scheduler role, Vercel IAM user with least privilege), Secrets Manager entries.
2. EC2 setup scripts (install Node, nginx, certbot, the API service + SQS worker as systemd units) + a runbook.
3. The Next.js admin app (Hebrew RTL) wired to AWS, ready to push to my GitHub repo and deploy on Vercel.
4. The unsubscribe page.
5. The React Native integration instructions.
6. A README covering: env vars (with placeholders, never real secrets), the rotate-the-Global-SMS-key reminder, DNS records I must add (`api.thevision.co.il` → Elastic IP; `smart.thevision.co.il` → Vercel), the Vercel env vars, Firebase/Apple console steps, and how to run/deploy/test each piece.
7. An "Open items I must provide" checklist: rotated Global SMS API key, approved `txtOriginator`, EC2 API token, webhook shared secret, reCAPTCHA site+secret keys, Firebase service-account JSON, and the two domains/DNS.

Build it incrementally and explain each major step as you go. Where my spec was ambiguous, follow the decisions encoded above and note any assumption you make.
