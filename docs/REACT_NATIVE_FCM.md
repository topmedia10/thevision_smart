# React Native + FCM integration (iOS & Android)

Push uses Firebase Cloud Messaging with a **topic** model. The server (sendPush
Lambda) sends one message to a topic, and every app install that subscribed to
that topic receives it. The server authenticates with a **service-account JSON**.

- Firebase project: **`thevision-a496b`**
- Topic: **`all`** (every install subscribes to it on first run)

> Trade-off chosen: topic send is simpler (no token registry, no device table,
> one line in the app) but FCM does not return a per-device delivery count — so
> the dashboard shows "last push sent at" rather than an exact number.

---

## Part A — Firebase Console (one-time, both platforms)

1. Open https://console.firebase.google.com → project **thevision-a496b**.
2. **Service account (server side — already provided):** Project Settings (⚙️) →
   **Service accounts** → **Generate new private key** → JSON. This is stored in
   AWS Secrets Manager `smart/firebase-service-account` for the push Lambda.
   (Only needed again if you ever regenerate/revoke that key.)

---

## Part B — Android

1. Firebase Console → **Add app → Android**.
   - **Android package name** = your app's `applicationId`
     (`android/app/build.gradle`). Use your existing one.
   - Register → download **`google-services.json`**.
2. Put it in **`android/app/google-services.json`**.
3. `android/build.gradle` (project) → `dependencies`:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```
4. `android/app/build.gradle` (top):
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

---

## Part C — iOS

### C1. Apple Developer (https://developer.apple.com/account)
1. **Identifiers** → your App ID → enable **Push Notifications**.
2. **Keys** → **+** → check **Apple Push Notifications service (APNs)** →
   Register → **download the `.p8`** (one time). Note the **Key ID** + **Team ID**.

### C2. Firebase Console
3. **Add app → iOS** → **Bundle ID** = your app's bundle id → Register →
   download **`GoogleService-Info.plist`**.
4. Project Settings → **Cloud Messaging** → **Apple app configuration** →
   upload the `.p8` + Key ID + Team ID.

### C3. Xcode
5. Drag **`GoogleService-Info.plist`** into the iOS target.
6. Target → **Signing & Capabilities** → add **Push Notifications** +
   **Background Modes → Remote notifications**.

---

## Part D — What the backend needs

| Item | Status |
|---|---|
| **Firebase service-account JSON** | ✅ already stored in Secrets Manager |

That's it — the backend needs nothing per-device. With topics there is **no**
device-registration endpoint and **no** device table. The `google-services.json`
and `GoogleService-Info.plist` go into your **app** (Parts B/C), not the backend.

---

## Part E — React Native app code (device side)

Install:
```bash
npm i @react-native-firebase/app @react-native-firebase/messaging
cd ios && pod install && cd ..
```

iOS `AppDelegate`: RNFirebase v15+ auto-configures from the plist (otherwise call
`[FIRApp configure]`).

On first run, request permission and **subscribe to the `all` topic** — that's
the entire integration:

```ts
// src/push.ts
import messaging from '@react-native-firebase/messaging';

export async function registerForPush() {
  // iOS needs explicit permission; Android 13+ also prompts.
  const status = await messaging().requestPermission();
  const granted =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return;

  // Subscribe to the broadcast topic. Idempotent — safe to call on every open.
  await messaging().subscribeToTopic('all');
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

Android 13+ (API 33) also needs the runtime permission in
`android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

That's the whole thing — once an install subscribes to `all`, every "שליחת פוש"
and the weekly push automation reach it. To later target groups, you can
subscribe devices to additional topics (e.g. per branch) and we add topic
selection in the dashboard.
