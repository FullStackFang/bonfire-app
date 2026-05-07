# Bonfire mobile — quickstart

How to run the iOS app on your iPhone for development. Works on WSL2/Windows/macOS/Linux. No Mac required.

## One-time setup (5 min)

### 1. Install Expo Go on your iPhone
Free, from the App Store: https://apps.apple.com/app/expo-go/id982107779

Requires iOS 15.1 or newer.

### 2. Install workspace deps (only if not already done)
From the repo root (`bonfire-app/`):
```bash
npm install
```

## Daily run (10 sec)

From `apps/mobile/`:
```bash
npx expo start --tunnel
```

Wait 10–30s for **"Tunnel ready"**. A QR code prints in the terminal.

### Connect your iPhone
- **Expo Go app** → tap "Scan QR code" (top right) → point at the QR
- Or **iOS Camera app** → point at the QR → tap the Expo Go banner that appears

First bundle compile: ~30–60s (slower on `/mnt/c`). Subsequent JS reloads: <2s.

### What you should see
- "Bonfire" title
- A subtitle line
- 5 colored status dots (Available, Out, Down, At a place, Invisible)

## Live development

- **Save any file** in `apps/mobile/` → app auto-reloads on the phone.
- **Shake your phone** → opens the dev menu (Reload, Toggle Inspector, Performance Monitor).
- **JS errors** render full-screen as red boxes with stack traces. The same trace also prints in your WSL terminal.

## Why `--tunnel` and not LAN?

WSL2 has its own network subnet — your iPhone can't reach `localhost:8081` inside WSL without Windows firewall rules and `netsh portproxy`. Tunnel mode routes through Expo's relay (`exp.direct`), bypassing the network entirely. Slower than LAN by ~200ms per refresh, but it just works.

If you're on macOS/Linux native (not WSL), drop `--tunnel` for ~200ms faster reloads:
```bash
npx expo start
```

## When this stops working — switching to a Dev Client

Expo Go ships with a fixed set of native modules. The moment you add a third-party native module that Expo Go doesn't include, the JS bundle won't load anymore. The most common case in this project: **MapLibre Native** (added on Day 5 of the build plan).

When that happens, switch to a **dev client build** — a one-time custom build of Expo Go with all your native modules baked in:

```bash
# 1. Build a dev client (cloud, ~10–15 min)
eas build --profile development --platform ios

# 2. Register your iPhone's UDID (one-time)
eas device:create
# follow prompts; install the resulting profile on your phone

# 3. Install the dev client on your phone (link from EAS Build output)
# 4. Run with --dev-client instead of bare tunnel:
npx expo start --tunnel --dev-client
```

Hot reload, dev menu, and the JS workflow are otherwise identical. You only need to rebuild the dev client when you change native dependencies (not for normal JS changes).

## Common gotchas

| Symptom | Fix |
|---|---|
| "Network response timed out" | Tunnel idle-disconnects after a few minutes. Rescan the QR. |
| Red error screen | A JS error. Read the stack trace; check the WSL terminal for fuller context. |
| QR doesn't open Expo Go | Use Expo Go's built-in scanner ("Scan QR code") instead of the iOS Camera. |
| Reanimated worklets warnings | Harmless on first boot; ignore unless rendering breaks. |
| Bundle compile hangs at 99% | Save any file to nudge Metro; or `r` in the terminal to reload. |
| "Cannot connect to Metro" | Quit Expo Go fully, kill `expo start`, run again. Tunnel servers are stateful. |

## Useful keys in the Expo terminal

| Key | Action |
|---|---|
| `r` | Reload the app |
| `j` | Open JS debugger in Chrome DevTools |
| `m` | Toggle dev menu on the phone |
| `?` | Show all commands |
| `Ctrl+C` | Stop Metro |

## Production builds (for reference)

For TestFlight builds, you don't run anything locally — EAS builds in the cloud:

```bash
eas build --profile preview --platform ios   # → TestFlight
eas submit --platform ios                     # uploads the build to App Store Connect
```

This is covered in Day 2 of the build plan. **Local production builds (`expo export`) do NOT work on this WSL2/ARM64 machine** — React Native only ships x86-64 Linux Hermes. Dev mode and EAS Build are unaffected.
