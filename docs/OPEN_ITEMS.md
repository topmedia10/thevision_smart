# Open items / go-live checklist

Status as of last work session. ✅ = done, ⬜ = remaining (mostly your input).

## Infrastructure & integrations — ✅ done
- [x] CDK stack deployed (`il-central-1`, account `975050130305`)
- [x] EC2 API + SQS worker installed & running; HTTPS via Cloudflare Origin Cert (`api.thevision.co.il`)
- [x] Security group allows 443 from Cloudflare IP ranges
- [x] Global SMS key + originator (`TheVision`) in `smart/global-sms` — **SOAP** API verified (balance + send)
- [x] Vercel project `thevision-smart` (root dir `web`) + all env vars + domain `smart.thevision.co.il`, auto-deploy from GitHub `main`
- [x] reCAPTCHA v2 (checkbox) keys set in Vercel
- [x] Firebase service-account in `smart/firebase-service-account`; push (topic `all`) verified
- [x] First admin user (בריאן אורלנד / +972505862107 / 43795)
- [x] Webhook URL given to the booking system (includes `?token=`)

## You still need to provide / do — ⬜
- [ ] **Rotate the Global SMS key** if the provided one is not already the rotated key (the original spec key was leaked). Update `smart/global-sms` then re-run `ec2/setup/install.sh`.
- [ ] **Populate Settings** in the admin UI → הגדרות: business name, address, booking link, Google review link, SMS unsubscribe link (these feed message variables + the textarea insert buttons). Also audience months (activeMonths/inactiveMonths) and balance-alert threshold + the two alert messages.
- [ ] **Configure & enable automations** (welcome / reviews / weekly-SMS / weekly-push) — messages, day/time, audience, filterDays.
- [ ] **Add the rest of the staff** in אנשי צוות (set גישה למערכת / להציג בשליחת SMS / התראות הטענת קרדיט per person).
- [ ] **React Native app** (later, separate session): build the app, then per `docs/REACT_NATIVE_FCM.md` — Firebase Android+iOS apps, `google-services.json` / `GoogleService-Info.plist`, APNs key, and `subscribeToTopic('all')`. Nothing more needed server-side.

## Nice-to-have / notes
- [ ] 3 phone numbers from the "review list" Excel were not found as customers (skipped in the sentReview migration). Ask if you want them listed.
- [ ] If Vercel shows a login wall on the production domain, check Settings → Deployment Protection (protect Preview only).
- [ ] `/devices/register` endpoint + `smart-device-tokens` table were **removed** (push uses FCM topics now).

## Secrets reference (AWS Secrets Manager, `il-central-1`)
| Secret | Used by | Contents |
|---|---|---|
| `smart/global-sms` | EC2 | `{ "apiKey", "originator" }` |
| `smart/ec2-api-token` | EC2 + Vercel/Lambdas | bearer token |
| `smart/webhook-secret` | API GW webhook | shared secret (also in the `?token=` URL) |
| `smart/firebase-service-account` | sendPush Lambda | Firebase service-account JSON |
