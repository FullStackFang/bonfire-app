# Web-Push Spike Implementation Plan (Days 1–3 Gate)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove (or disprove) that a push notification can reach the lock screen of an installed iOS PWA served from the Expo web export of `apps/mobile` — the go/no-go gate from spec §Platform that decides whether phase 1 ships Expo-universal or falls back to `apps/web`.

**Architecture:** A throwaway route (`/push-spike`) in the existing Expo Router app, plus static PWA assets (`manifest.json`, `sw.js`) served from `apps/mobile/public/`. Web output mode is `single` (SPA) — no static rendering, so native-only modules (MapLibre, Skia) in other routes ship in the bundle but never execute. PWA head tags are injected at runtime by the spike route. Push delivery is a local Node script using the `web-push` library with VAPID keys; the production Edge Function sender comes later — the crypto path it proves is identical.

**Tech Stack:** Expo SDK 54 web export (Metro, SPA output), Web Push API + VAPID, `web-push` (Node sender), Vercel static deploy.

**Verification instead of unit tests:** This is a spike — throwaway proof, no test infra exists in the repo, and the system under test is Safari/APNs behavior that cannot be unit-tested. Every task ends with an observable verification step with expected output. Two human-only tasks (6, 7) require the founder's physical iPhone (iOS 16.4+) and are marked **YOU**.

**Go/no-go criteria (decided end of day 3 at the latest):**
- **GO:** a notification sent from the dev machine appears on the iPhone lock screen while the installed PWA is closed.
- **Investigate before declaring no-go:** export fails on a native-only module (fixable with a platform fork or lazy import); desktop Chrome works but iPhone subscribe fails (usually a manifest/install-mode issue).
- **NO-GO:** end of day 3 without a lock-screen notification → phase 1 ships in `apps/web` (Next.js) on the shared packages. Record the decision either way (Task 7, final step).

---

### Task 1: Sender tooling + VAPID keys

**Files:**
- Modify: `package.json` (repo root)
- Modify: `.gitignore` (repo root)
- Create: `scripts/send-push.mjs`
- Create (generated, gitignored): `spike/vapid.json`

- [ ] **Step 1: Add `web-push` as a root devDependency**

In root `package.json`, add a `devDependencies` block after `"scripts"`:

```json
  "devDependencies": {
    "web-push": "^3.6.7"
  }
```

Run (bash, repo root): `npm install`
Expected: lockfile updates, exit 0.

- [ ] **Step 2: Gitignore the spike secrets directory**

Append to root `.gitignore`:

```
# push spike — VAPID private key + device subscriptions, never commit
spike/
```

- [ ] **Step 3: Generate VAPID keys**

Run (bash, repo root):
```bash
mkdir -p spike && npx web-push generate-vapid-keys --json > spike/vapid.json && cat spike/vapid.json
```
Expected: JSON with `publicKey` (87-char base64url starting with `B`) and `privateKey`.

- [ ] **Step 4: Write the sender script**

Create `scripts/send-push.mjs`:

```js
import webpush from "web-push";
import { readFileSync } from "node:fs";

// usage: node scripts/send-push.mjs [subscription.json] [title] [body]
const [
  ,
  ,
  subPath = "spike/subscription.json",
  title = "The fire is dimming",
  body = "Thursday matters.",
] = process.argv;

const vapid = JSON.parse(readFileSync("spike/vapid.json", "utf8"));
webpush.setVapidDetails("mailto:fullstackfang@gmail.com", vapid.publicKey, vapid.privateKey);

const subscription = JSON.parse(readFileSync(subPath, "utf8"));
const result = await webpush.sendNotification(
  subscription,
  JSON.stringify({ title, body, url: "/push-spike" })
);
console.log(`sent: HTTP ${result.statusCode}`);
```

- [ ] **Step 5: Verify the script fails cleanly without a subscription**

Run (bash): `node scripts/send-push.mjs`
Expected: `ENOENT ... spike/subscription.json` (proves vapid.json parsed fine; subscription arrives in Task 4).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore scripts/send-push.mjs
git commit -m "chore(spike): web-push sender + vapid scaffolding"
```

---

### Task 2: PWA static assets + web export config

**Files:**
- Create: `apps/mobile/public/manifest.json`
- Create: `apps/mobile/public/sw.js`
- Create: `apps/mobile/public/icons/icon.png` (copy of existing app icon)
- Create: `apps/mobile/.env`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Create the manifest**

Create `apps/mobile/public/manifest.json`:

```json
{
  "name": "Bonfire",
  "short_name": "Bonfire",
  "id": "/push-spike",
  "start_url": "/push-spike",
  "scope": "/",
  "display": "standalone",
  "background_color": "#fff7f1",
  "theme_color": "#f05846",
  "icons": [
    { "src": "/icons/icon.png", "sizes": "any", "type": "image/png" }
  ]
}
```

(`start_url` points at the spike route so the installed icon opens straight into it; this changes to `/` when the real app ships.)

- [ ] **Step 2: Create the service worker**

Create `apps/mobile/public/sw.js`:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  // iOS requires showing a notification for every push — no silent pushes.
  event.waitUntil(
    self.registration.showNotification(data.title || "Bonfire", {
      body: data.body || "The fire is calling.",
      icon: "/icons/icon.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow((event.notification.data && event.notification.data.url) || "/"));
});
```

- [ ] **Step 3: Copy the app icon into public**

Run (bash, repo root):
```bash
mkdir -p apps/mobile/public/icons && cp apps/mobile/assets/images/icon.png apps/mobile/public/icons/icon.png
```

- [ ] **Step 4: Put the VAPID public key in app env**

Create `apps/mobile/.env` (public key only — the private key never leaves `spike/`). Take `publicKey` from `spike/vapid.json`:

```
EXPO_PUBLIC_VAPID_PUBLIC_KEY=<publicKey value from spike/vapid.json>
```

Verify `.env` is already gitignored: `git check-ignore apps/mobile/.env` → prints the path. If it doesn't, add `apps/mobile/.env` to `.gitignore` before continuing.

- [ ] **Step 5: Add explicit web config to app.json**

In `apps/mobile/app.json`, add inside `"expo"` (after `"android"`):

```json
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
```

(`single` = SPA: routes are required lazily at runtime, so MapLibre/Skia imports in v1 routes are bundled but never executed during export or on the spike route. `static` output would execute every route in Node at export time and is exactly the fight we're not picking this week.)

- [ ] **Step 6: Verify the web export builds and carries the assets**

Run (bash, from `apps/mobile`):
```bash
npx expo export --platform web && ls dist/sw.js dist/manifest.json dist/icons/icon.png dist/index.html
```
Expected: export completes (first real signal that the app builds for web at all) and all four paths list. If the export fails on a native-only module, note the module — that's an *investigate*, not a no-go (lazy-import or platform-fork it), and it must be resolved before Task 4.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/public apps/mobile/app.json
git commit -m "feat(spike): PWA manifest, service worker, web export config"
```

---

### Task 3: The spike route

**Files:**
- Create: `apps/mobile/app/push-spike.tsx`

Expo Router auto-discovers the route — no `_layout.tsx` change needed (the explicit `<Stack.Screen>` entries there only customize options).

- [ ] **Step 1: Write the route**

Create `apps/mobile/app/push-spike.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

const EMBER = "#f05846";
const COAL = "#231715";
const CREAM = "#fff7f1";
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function injectPwaHeadTags() {
  const ensure = (selector: string, create: () => HTMLElement) => {
    if (!document.head.querySelector(selector)) document.head.appendChild(create());
  };
  ensure('link[rel="manifest"]', () => {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json";
    return l;
  });
  ensure('link[rel="apple-touch-icon"]', () => {
    const l = document.createElement("link");
    l.rel = "apple-touch-icon";
    l.href = "/icons/icon.png";
    return l;
  });
  ensure('meta[name="apple-mobile-web-app-capable"]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-capable";
    m.content = "yes";
    return m;
  });
  ensure('meta[name="apple-mobile-web-app-title"]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-title";
    m.content = "Bonfire";
    return m;
  });
}

export default function PushSpike() {
  const [standalone, setStandalone] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [permission, setPermission] = useState<string>("unknown");
  const [subscription, setSubscription] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog((p) => [...p, m]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    injectPwaHeadTags();
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          setSwReady(true);
          const existing = await reg.pushManager.getSubscription();
          if (existing) setSubscription(JSON.stringify(existing.toJSON()));
        })
        .catch((e) => say(`SW register failed: ${e.message}`));
    } else {
      say("No serviceWorker in navigator");
    }
  }, []);

  const enable = () => {
    // Must run inside the tap gesture on iOS.
    if (typeof Notification === "undefined") {
      say("Notification API unavailable — open from the Home Screen icon, not a Safari tab.");
      return;
    }
    Notification.requestPermission()
      .then(async (perm) => {
        setPermission(perm);
        if (perm !== "granted") {
          say(`Permission: ${perm}`);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        setSubscription(JSON.stringify(sub.toJSON()));
        say("Subscribed.");
      })
      .catch((e) => say(`Subscribe failed: ${e.message}`));
  };

  const copySub = async () => {
    if (!subscription) return;
    await navigator.clipboard.writeText(subscription);
    say("Copied to clipboard.");
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: CREAM }}>
        <Text style={{ color: COAL }}>Web-only spike. Open the web build.</Text>
      </View>
    );
  }

  const Status = ({ label, ok }: { label: string; ok: boolean }) => (
    <Text style={{ color: COAL, fontSize: 16, marginBottom: 4 }}>
      {ok ? "✅" : "⬜"} {label}
    </Text>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: CREAM }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 28, color: EMBER, marginBottom: 16 }}>Push spike</Text>
      <Status label="VAPID key baked into build" ok={VAPID_PUBLIC_KEY.length > 0} />
      <Status label="Running standalone (installed)" ok={standalone} />
      <Status label="Service worker registered" ok={swReady} />
      <Status label={`Notification permission: ${permission}`} ok={permission === "granted"} />
      <Status label="Push subscription active" ok={!!subscription} />

      {!standalone && (
        <Text style={{ color: COAL, marginVertical: 12 }}>
          On iPhone: tap Share → Add to Home Screen, then open Bonfire from the icon.
        </Text>
      )}

      <Pressable onPress={enable} style={{ backgroundColor: EMBER, borderRadius: 999, padding: 16, marginTop: 16, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>Enable notifications</Text>
      </Pressable>

      {subscription && (
        <>
          <Pressable onPress={copySub} style={{ backgroundColor: COAL, borderRadius: 999, padding: 16, marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 17 }}>Copy subscription JSON</Text>
          </Pressable>
          <Text selectable style={{ color: COAL, fontSize: 11, marginTop: 12, fontFamily: Platform.select({ web: "monospace" }) }}>
            {subscription}
          </Text>
        </>
      )}

      {log.map((m, i) => (
        <Text key={i} style={{ color: EMBER, marginTop: 8 }}>{m}</Text>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify it renders in the dev server**

Run (bash, from `apps/mobile`): `npx expo start --web` then open `http://localhost:8081/push-spike` in desktop Chrome.
Expected: "Push spike" page renders; "VAPID key baked into build" shows ✅; "Service worker registered" shows ✅ (dev server serves `public/` at root). "Running standalone" stays ⬜ on desktop — correct.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/push-spike.tsx
git commit -m "feat(spike): /push-spike route — SW registration, subscribe, head-tag injection"
```

---

### Task 4: End-to-end on desktop Chrome (validates everything except iOS)

**Files:**
- Create (generated, gitignored): `spike/subscription.json`

- [ ] **Step 1: Export and serve the production build**

Run (bash, from `apps/mobile`):
```bash
npx expo export --platform web && npx serve dist -s -l 3333
```
Expected: serving at `http://localhost:3333` (localhost is a secure context — SW and push work without HTTPS).

- [ ] **Step 2: Subscribe in Chrome**

Open `http://localhost:3333/push-spike` in desktop Chrome → click **Enable notifications** → allow.
Expected: "Push subscription active ✅" and the JSON appears.

- [ ] **Step 3: Save the subscription**

Click **Copy subscription JSON**, paste into `spike/subscription.json`.

- [ ] **Step 4: Send a push**

Run (bash, repo root): `node scripts/send-push.mjs`
Expected: `sent: HTTP 201` and a "The fire is dimming / Thursday matters." notification from Chrome — **with the tab closed** (close it first to prove it's push, not the page).

- [ ] **Step 5: Checkpoint**

Desktop end-to-end proves: SW, subscribe flow, VAPID signing, payload encryption, notification render. Everything that remains is iOS-specific. No commit (no repo changes in this task).

---

### Task 5: Deploy to Vercel

**Files (as built — two gotchas reshaped this task, see note):**
- Create: `apps/mobile/vercel.json` (deploy-root config: skip install/build, `outputDirectory: dist`, SPA rewrite)
- Create: `apps/mobile/.vercelignore` (upload only `dist/` + `vercel.json`)

- [x] **Step 1: Write the deploy config**

Create `apps/mobile/vercel.json`:

```json
{
  "installCommand": "",
  "buildCommand": "",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Create `apps/mobile/.vercelignore`:

```
*
!dist
!dist/**
!vercel.json
```

> **As-built note — why not the original `dist/vercel.json` approach:** (1) `vercel link`/`deploy` walk **up** from `dist/` and anchor the project at `apps/mobile`, so the upload root is `apps/mobile` regardless of cwd — and the framework-Other default "Output Directory: `public` if it exists" then serves *only* `apps/mobile/public/` (sw.js/manifest 200, index.html 404). Fix: configure the `apps/mobile` root explicitly with `outputDirectory: dist`. (2) `cleanUrls: true` conflicts with a rewrite destination of `/index.html` (cleanUrls strips `.html` paths, the rewrite target stops existing → 404). Don't combine them.

- [x] **Step 2: Export fresh and deploy**

Run (bash, from `apps/mobile`; one-time `npx vercel link --yes --project bonfire-pwa-spike` first, `npx vercel login` if unauthenticated):
```bash
npx expo export --platform web && npx vercel deploy --prod --yes
```
Expected: `Aliased: https://bonfire-pwa-spike.vercel.app`.

- [ ] **Step 3: Verify the deployed assets**

Run (bash):
```bash
curl -sI https://bonfire-pwa-spike.vercel.app/sw.js | head -1 && curl -s https://bonfire-pwa-spike.vercel.app/manifest.json
```
Expected: `HTTP/2 200` and the manifest JSON (not the SPA HTML — confirms static files beat the rewrite).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/vercel.json apps/mobile/.vercelignore
git commit -m "feat(spike): vercel deploy config for web export"
```

---

### Task 6: iPhone install + subscribe — **YOU** (requires iOS 16.4+)

No repo files. On the iPhone:

- [ ] **Step 1:** Open the production URL in **Safari** → navigate to `/push-spike` (or just the root URL — `start_url` lands on the spike).
- [ ] **Step 2:** Tap **Share → Add to Home Screen → Add**. (This is the same hard onboarding step real users will do.)
- [ ] **Step 3:** Open **Bonfire from the home-screen icon** (not the Safari tab). Expected: "Running standalone (installed) ✅".
- [ ] **Step 4:** Tap **Enable notifications** → Allow. Expected: "Push subscription active ✅".
- [ ] **Step 5:** Tap **Copy subscription JSON** and get it to the dev machine (email/message it to yourself), saved as `spike/subscription-iphone.json`.

**If step 4 fails:** screenshot the status lines + log output. Permission `denied` after a previous dismissal requires reinstall (remove from home screen, re-add) — iOS remembers per-install.

---

### Task 7: The gate — push to a locked iPhone, record the decision

**Files:**
- Modify: `docs/superpowers/plans/2026-06-09-v2-pivot-plan.md` (Phase 3, gate 1)
- Modify: `docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md` (§Platform)

- [ ] **Step 1: Send with the app open** (installed PWA foregrounded)

Run (bash): `node scripts/send-push.mjs spike/subscription-iphone.json`
Expected: `sent: HTTP 201`, notification banner on the phone.

- [ ] **Step 2: Send with the app killed and phone locked** — the real test

**YOU:** swipe the PWA out of the app switcher, lock the phone. Then run:
```bash
node scripts/send-push.mjs spike/subscription-iphone.json "It roared last night" "12 of you."
```
Expected: `sent: HTTP 201` and the notification on the **lock screen** within seconds. Tapping it opens the PWA (notificationclick → openWindow).

- [ ] **Step 3: Record the decision**

In `2026-06-09-v2-pivot-plan.md` Phase 3 gate 1 and spec §Platform, replace the open gate with the outcome — one of:
- **GO (expected):** "Gate 1 resolved <date>: web push verified on installed iOS PWA from Expo web export. Phase 1 ships Expo-universal; `apps/web` demoted to marketing/deleted."
- **NO-GO:** "Gate 1 resolved <date>: <what failed despite investigation>. Phase 1 ships in `apps/web` (Next.js) on shared packages; Expo remains the phase-2 native codebase."

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-06-09-v2-pivot-plan.md docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md
git commit -m "docs: resolve platform gate — web-push spike result"
```

---

## After this plan

The spike route, `public/` assets, and sender script are **kept** (they become the real notification plumbing's skeleton — the SW and VAPID flow carry forward; only the copy/paste subscription transfer gets replaced by a `push_subscriptions` table). Next plans, in order:

1. **Schema reset** (platform-independent, can start in parallel with Tasks 6–7): new migrations + RLS + `metrics.sql` per pivot plan Phase 2.
2. **Phase 1 prune + week-1 loop** (after the gate): kill v1 surfaces, 3-tab shell, email-OTP auth, groups, anchor + RSVP.
