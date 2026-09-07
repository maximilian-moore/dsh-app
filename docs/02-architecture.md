# 02 — Architecture

## 1. Overview

The harness already provides a durable session store, a session-query service, the agent runtime, and cookie auth. The architecture keeps that server loopback-only on the Mac and fronts it with Tailscale. 

The client is a **Progressive Web App (PWA)**:
- Served directly from the Mac over Tailscale HTTPS (`tailscale serve`).
- Installed on Android Chrome (WebAPK) or iPad Safari (standalone mode).
- Uses the **W3C Web Push API** via a Service Worker for background approval alerts and completion notifications.
- Interacts with a lightweight **Mobile Bridge** (`dsh-remote-bridge`) exposing a stable `/mobile/*` API and mobile-first UI.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Mac at home (always on)                                               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  DeepSeek Harness  (dsh web)  — loopback 127.0.0.1:3080         │  │
│  │                                                                  │  │
│  │   session store ── session-query ──►  web GUI (SPA)             │  │
│  │   (JSONL, ~/.dsh)                      ▲                        │  │
│  │   agent runtime                        │                        │  │
│  │   BrowserAuth / connection             │                        │  │
│  │               │                        │                        │  │
│  │               ▼                        │                        │  │
│  │     dsh-remote-bridge plugin           │                        │  │
│  │     - /mobile/ UI (PWA static assets)  │                        │  │
│  │     - /mobile/* REST & SSE stream      │                        │  │
│  │     - Web Push Service (VAPID)         │                        │  │
│  │     - Workspace & Git clone manager    │                        │  │
│  │                                                                  │  │
│  └─────────────────────────────────────┼────────────────────────────┘  │
│                         Tailscale (tailscaled) + tailscale serve        │
└─────────────────────────────────────────┼──────────────────────────────┘
                                          │  WireGuard + HTTPS (tailnet-only)
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  Phone (Honor Pro 400) / iPad               │
                    │  - Tailscale app (WireGuard mesh)           │
                    │  - Android Chrome PWA (WebAPK standalone)   │
                    │  - Service Worker (caching + push handler)  │
                    │  - Native Web Push notifications            │
                    └─────────────────────────────────────────────┘
```

## 2. Harness facts this design relies on (verified in source)

- The web server binds **loopback only**; `--host 0.0.0.0` is intentionally rejected ("would expose remote code execution"). Do not try to bind it wider.
- Auth = a **launch token** in the boot URL that mints a **signed, authority-bound cookie**; everything else is 401. The signing secret is persisted in `~/.dsh`, so the cookie survives PC restart; the launch token is per-process.
- The `/api` surface has a **browser-trust fence** (DNS-rebinding protection). A non-loopback `Host` must be declared via `--trusted-host <authority>`.
- Conversation list + history come from `session-query` (`listSessions`, `load`) over the JSONL persistence — the same store the web app shows.
- The server's gzip middleware already special-cases `text/event-stream`, so **SSE** is a natural streaming transport.

## 3. Transport & Networking

- **Harness:** `dsh web --trusted-host <mac>.<tailnet>.ts.net` (loopback, port 3080).
- **Tailscale:** `tailscale serve --bg http://127.0.0.1:3080` → publishes `https://<mac>.<tailnet>.ts.net` to the tailnet only, with a Tailscale-managed TLS certificate.
- **Why this satisfies PWA & Web Push:**
  - Modern browsers require a **Secure Context (HTTPS)** to register Service Workers and subscribe to the `PushManager`.
  - Tailscale's MagicDNS TLS cert on `.ts.net` satisfies browser security requirements natively, without self-signed cert warnings.
- **Phone Access:** Reaches `https://<mac>.<tailnet>.ts.net` seamlessly over the Tailscale VPN tunnel.

## 4. Client PWA Architecture

The client runs as a standalone PWA without requiring Android Studio, Gradle, or APK distribution:

- **Web App Manifest (`manifest.webmanifest`):**
  - `display: "standalone"` — launches without browser address bar or bottom bar.
  - `theme_color` & `background_color` matching the app theme.
  - High-resolution adaptive icons for home screen and splash.
  - `start_url: "/mobile/"`
- **Service Worker (`sw.js`):**
  - **Push Listener:** Catches incoming Web Push events from the Mac and calls `self.registration.showNotification()`.
  - **Action Handlers:** Supports notification actions (e.g. `Approve`, `Reject`, `View`) that can send an approval POST directly or focus the PWA window.
  - **Asset Caching:** Caches core UI shell assets for instant startup; data routes remain network-first.
- **Responsive Mobile UI:**
  - Designed for thumb use on 6–7" phone displays (and tablets).
  - Virtual keyboard resilience (`<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">`).
  - Haptic feedback on actions (`navigator.vibrate()`).

## 5. `dsh-remote-bridge` Plugin & API

A reusable Host plugin registering routes on the **existing** `webServer` (same port, so `tailscale serve` already fronts it).

| Capability | Bridge Route / Method | Description |
|---|---|---|
| PWA Entry | `GET /mobile/` | Serves the mobile-optimized PWA static bundle |
| Web App Manifest | `GET /mobile/manifest.webmanifest` | PWA installation metadata |
| Service Worker | `GET /mobile/sw.js` | Service worker script |
| List sessions | `GET /mobile/api/sessions` | Returns conversation list via `session-query` |
| Load session | `GET /mobile/api/sessions/{id}` | Returns full message & tool execution history |
| Prompt & Stream | `POST /mobile/api/sessions/{id}/prompt` | Dispatches user prompt to session agent |
| Live Events (SSE) | `GET /mobile/api/stream?sessionId={id}` | SSE stream for real-time text chunks & tool calls |
| Approvals | `POST /mobile/api/approvals/{id}` | Approve or reject pending tool calls |
| Workspace list/set | `GET\|POST /mobile/api/workspace` | Get or update session working directory |
| Git Clone | `POST /mobile/api/workspace/clone` | Triggers background clone on Mac using Mac's Git |
| Push Subscribe | `POST /mobile/api/push/subscribe` | Registers browser `PushSubscription` JSON |
| Push Unsubscribe | `POST /mobile/api/push/unsubscribe` | Removes active subscription |
| Device Auth / Re-issue | `POST /mobile/api/auth/token` | Re-mints valid cookie using paired device secret |

### Reusability (FR6)

Configured via standard DSH composition:
```yaml
- id: dsh-remote-bridge
  config:
    allowedWorkspaceRoots: ["~/DevProjects"]
    cookieMaxAgeDays: 365
    vapidKeysPath: "~/.dsh/vapid.json"
```

## 6. Authentication & Push Subscription Flow

1. **Initial Pairing (One-time):**
   - On first open over Tailnet, user opens `https://<mac>.<tailnet>.ts.net/?token=<launchToken>`.
   - DSH issues an HTTP-only, secure, signed cookie valid for 180–365 days.
   - PWA generates a random Device Key stored in browser `IndexedDB` and registers it with the bridge.
2. **Push Setup:**
   - User taps "Enable Notifications" in the PWA.
   - Browser asks for notification permission.
   - Browser contacts Google Push Service via `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })`.
   - Resulting endpoint and keys are sent to `POST /mobile/api/push/subscribe`.
3. **Approval Notification Event:**
   - Agent requests a tool execution needing confirmation.
   - Bridge checks active push subscriptions, signs payload with private VAPID key (RFC 8292), and sends to push endpoint.
   - Android shows system notification: *"DSH: Approval Required - Run git push origin main"*.
   - User taps **Approve** directly from notification or opens PWA.

## 7. Security Model & Lost Device Revocation

### Defense-in-Depth Layers
1. **Network Layer (WireGuard):** DSH is only bound to `127.0.0.1`. The only ingress is `tailscale serve` over an encrypted WireGuard mesh. No public ports exist, and `tailscale funnel` is strictly prohibited.
2. **Tailscale ACLs (Device Isolation):** Tailscale ACL rules can restrict port 3080 so that *only* the authorized phone (`tag:mobile-client` or node `honor-400-pro`) can communicate with the Mac on that port.
3. **Application Layer (Signed Cookie + Device Key):** The browser cookie is cryptographic, authority-bound, and signed with a Mac-local secret.
4. **Execution Blast Radius (Workspace Sandboxing):** The bridge only allows setting session roots or cloning into whitelisted paths (e.g. `~/DevProjects`). It refuses paths outside this root (like `~/.ssh`, `/etc`, or `/System`).
5. **Web Push Privacy:** Push payloads are end-to-end encrypted using RFC 8291 (ECDH curve P-256). Intermediaries (Google's push servers) cannot read the notification body.

### Lost Phone Revocation Protocol

If the phone is lost or stolen:

1. **Instant Network Kill-Switch (Zero Trust):**
   - Open the [Tailscale Admin Console](https://login.tailscale.com/admin/machines).
   - Click the phone device (`honor-400-pro`) and select **Disable Key Sharing** or **Remove from tailnet**.
   - **Effect:** Immediately cuts off all network routing at the WireGuard layer within seconds. The phone can no longer establish a TCP/TLS connection to the Mac.
2. **Application Cookie & Token Invalidation:**
   - Delete `~/.dsh/paired_devices.json` on the Mac (or remove the specific device entry).
   - Restart `dsh web` (or delete the cookie signing secret in `~/.dsh`) to invalidate all existing cookies.
3. **Web Push Invalidation:**
   - Clear `~/.dsh/push_subscriptions.json` on the Mac. The Mac will immediately stop transmitting push notifications to the phone's push endpoint.

## 8. Client Stack

- **Format:** Progressive Web App (PWA) with Web App Manifest & Service Worker.
- **Frontend Stack:** Modern responsive UI (Vanilla JS / Preact / Tailwind CSS) with dark mode by default.
- **Communication:** Fetch API for REST endpoints; `EventSource` (SSE) for token streaming and real-time tool state updates.
- **Notifications:** W3C Push API + Notification API.
- **Storage:** Browser `IndexedDB` / `localStorage` for UI preferences and device pairing key.
