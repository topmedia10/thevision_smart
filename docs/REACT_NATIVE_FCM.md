# React Native + FCM integration (iOS & Android)

Push uses Firebase Cloud Messaging. The server (sendPush Lambda) sends via the
Firebase Admin SDK using a **service-account JSON**. Each device registers its
FCM token to the backend so push counts are real.

- Firebase project: **`thevision-a496b`**
- Device registration endpoint (POST JSON `{ token, platform }`):
  `https://xtj2r7vhq7.execute-api.il-central-1.amazonaws.com/devices/register`

---

## Part A — Firebase Console (one-time, both platforms)

1. Open https://console.firebase.google.com → project **thevision-a496b**.
2. **Service account (server side — give this to the backend):**
   Project Settings (⚙️) → **Service accounts** → **Generate new private key** →
   downloads a JSON file. **Send this JSON to me** — it goes into AWS Secrets
   Manager `smart/firebase-service-account` for the push Lambda. Treat it as a
   secret; never commit it.

---

## Part B — Android

1. Firebase Console → **Add app → Android**.
   - **Android package name** = your app's `applicationId` (from
     `android/app/build.gradle`, e.g. `com.thevision.queue`). Use your existing one.
   - Register → download **`google-services.json`**.
2. Put `google-services.json` in **`android/app/google-services.json`**.
3. `android/build.gradle` (project level) → add to `dependencies`:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```
4. `android/app/build.gradle` → at the very top apply the plugin:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
   (No APNs needed for Android.)

---

## Part C — iOS

### C1. Apple Developer portal (https://developer.apple.com/account)
1. **Identifiers** → your App ID (bundle id) → enable **Push Notifications**.
2. **Keys** → **+** → name it, check **Apple Push Notifications service (APNs)**
   → Continue → Register → **Download the `.p8` file** (one download only).
   Note the **Key ID** and your **Team ID** (top-right of the portal).

### C2. Firebase Console
3. **Add app → iOS**.
   - **Bundle ID** = your app's bundle identifier (Xcode → target → General).
   - Register → download **`GoogleService-Info.plist`**.
4. Project Settings → **Cloud Messaging** → **Apple app configuration** →
   **APNs Authentication Key** → **Upload** the `.p8` + Key ID + Team ID.

### C3. Xcode
5. Drag **`GoogleService-Info.plist`** into the iOS project (target
   `ios/<AppName>/`), "Copy if needed", add to target.
6. Target → **Signing & Capabilities** → **+ Capability** → add
   **Push Notifications** and **Background Modes** → check **Remote notifications**.

---

## Part D — What to send me (to wire into the backend)

| Item | Why |
|---|---|
| **Firebase service-account JSON** (Part A) | I load it into `smart/firebase-service-account`; the push Lambda needs it to send. **Required.** |
| Android **package name** + iOS **bundle ID** | For my records / confirming the RN steps. |

The `google-services.json` and `GoogleService-Info.plist` go into **your app**
(Parts B/C), not the backend — keep them in the app repo.

---

## Part E — React Native app code (device side)

Install:
```bash
npm i @react-native-firebase/app @react-native-firebase/messaging
cd ios && pod install && cd ..
```

iOS `AppDelegate` — ensure Firebase is configured (RNFirebase v15+ auto-configures
from the plist; if you initialize manually, call `[FIRApp configure]`).

Add a small module and call it on every app open + on token refresh:

```ts
// src/push.ts
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

const REGISTER_URL =
  'https://xtj2r7vhq7.execute-api.il-central-1.amazonaws.com/devices/register';

async function sendToken(token: string) {
  await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    }),
  });
}

export async function registerForPush() {
  // iOS needs explicit permission; Android 13+ also prompts.
  const status = await messaging().requestPermission();
  const granted =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return;

  const token = await messaging().getToken();
  if (token) await sendToken(token);

  // Re-register whenever FCM rotates the token.
  messaging().onTokenRefresh((t) => sendToken(t));
}
```

Call it once after the app mounts:
```ts
// App.tsx
import { useEffect } from 'react';
import { registerForPush } from './src/push';

useEffect(() => {
  registerForPush().catch(() => {});
}, []);
```

Android 13+ (API 33) also requires the runtime permission
`POST_NOTIFICATIONS` — `requestPermission()` above triggers it via RNFirebase,
but make sure `android/app/src/main/AndroidManifest.xml` contains:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

That's it — once a device runs this, it appears in `smart-device-tokens`, and
"שליחת פוש" / the weekly push will reach it. The dashboard's "כמות הודעות פוש
שנשלחו בשליחה האחרונה" reflects the real multicast success count.

> Note: `/devices/register` is currently open (no auth) for simplicity. If you
> want it abuse-protected later, we can add a shared header/key the app sends.
