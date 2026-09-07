# 03 — Roadmap

Effort figures are for one developer and are planning estimates, not commitments.

## Phase 0 — Validate the network path (no app code)

**Goal:** prove the phone can reach the web GUI over Tailscale before writing any client code.

- [ ] Ensure Tailscale is running on Mac + Honor Pro 400 (both on same personal tailnet).
- [ ] Determine Tailscale FQDN (e.g. `macbook-pro-von-max.<tailnet>.ts.net`).
- [ ] Run `dsh web --trusted-host <mac>.<tailnet>.ts.net --no-open`.
- [ ] Run `tailscale serve --bg http://127.0.0.1:3080`.
- [ ] On the phone browser (Android Chrome), open `https://<mac>.<tailnet>.ts.net/?token=<launch-token>`.
- [ ] Confirm GUI loads, session history appears, streaming responds, and cookie is stored.

**Effort:** ~0.5–1 day. **Exit criteria:** phone controls DSH from Chrome over cellular/remote network.

## Phase 1 — PWA Baseline & Web Push Enablement

**Goal:** make DSH installable to the home screen and enable instant Web Push notifications for approvals.

- [ ] Create/configure Web App Manifest (`manifest.webmanifest`) with `display: "standalone"`, icons, and app theme.
- [ ] Implement Service Worker (`sw.js`) with:
  - Cache handler for core app shell.
  - Push event handler: receives VAPID push payload and invokes `self.registration.showNotification()`.
  - Notification click handler: handles action buttons (e.g., `Approve`, `Dismiss`) or focuses open window.
- [ ] Set up server-side Web Push module (VAPID key generation, `POST /mobile/api/push/subscribe` endpoint).
- [ ] Verify "Add to Home Screen" on Android Chrome (WebAPK creation) and test approval push notification on the Honor Pro 400.

**Effort:** ~1–2 days. **Exit criteria:** DSH launches full-screen from phone home screen without browser chrome, and background approval pushes alert the device.

## Phase 2 — `dsh-remote-bridge` Plugin & Mobile UI

**Goal:** build the mobile-optimized Claude-Code-like interface and stable `/mobile/*` API.

- [ ] Plugin skeleton registered in DSH host composition.
- [ ] Implement core mobile routes:
  - `GET /mobile/api/sessions` (list sessions via `session-query`).
  - `GET /mobile/api/sessions/{id}` (load message/tool history).
  - `POST /mobile/api/sessions/{id}/prompt` + SSE stream (`/mobile/api/stream`).
  - `POST /mobile/api/approvals/{id}` (approve/reject tool actions).
- [ ] Implement mobile-first responsive PWA UI:
  - Session drawer & search.
  - Streaming conversation view with smooth autoscroll and syntax highlighting.
  - Prominent tool approval cards with one-tap Approve/Reject.
  - Bottom docked input with virtual keyboard padding (`interactive-widget=resizes-content`).

**Effort:** ~3–5 days. **Exit criteria:** phone has a tailored, thumb-friendly mobile UI with real-time streaming and one-tap approvals.

## Phase 3 — Workspace & GitHub Clone Integration

**Goal:** allow switching local project directories and cloning private GitHub repos from the phone.

- [ ] Workspace routes:
  - `GET /mobile/api/workspace` (list whitelisted directories under `~/DevProjects`).
  - `POST /mobile/api/workspace` (change session working directory).
- [ ] Git clone route:
  - `POST /mobile/api/workspace/clone` (clones private repo on the Mac using Mac's existing Git credentials).
- [ ] Security boundaries: enforce directory sandboxing so sessions cannot be pointed outside whitelisted project roots.

**Effort:** ~2–3 days. **Exit criteria:** user can clone a GitHub repo from their phone and start a DSH session on it.

## Phase 4 — Polish & Advanced Hardening

- [ ] Tailscale ACL configuration to lock port 3080 strictly to the phone's Tailscale IP/tag.
- [ ] iPad responsiveness and layout enhancements.
- [ ] Offline status banner and automatic reconnection logic.

## Suggested Sequencing

Phase 0 (validate network & origin) → Phase 1 (PWA install & Web Push) → Phase 2 (Mobile UI & Bridge) → Phase 3 (Workspace/Git) → Phase 4 (Polish).
Total estimated time: **~1.5 to 2 weeks**.
