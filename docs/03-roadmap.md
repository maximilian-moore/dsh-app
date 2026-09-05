# 03 — Roadmap

Effort figures are for one developer and are planning estimates, not commitments.

## Phase 0 — Validate the network path (no app code)

**Goal:** prove the phone can reach the web GUI over Tailscale before writing any client.

- [ ] Install Tailscale on the Mac + phone; enable MagicDNS (personal free tailnet).
- [ ] Run `dsh web --trusted-host <mac>.<tailnet>.ts.net`.
- [ ] Run `tailscale serve --bg http://127.0.0.1:3080`.
- [ ] On the phone browser, open `https://<mac>.<tailnet>.ts.net/<boot-token-URL>`; confirm the GUI loads, conversations list, and streaming work.
- [ ] Confirm the `/api` trust fence accepts the tailnet authority (fix `--trusted-host` authority if 403).

**Effort:** ~0.5–1 day. **Exit criteria:** phone controls DSH from a browser on cellular data.

## Phase 1 — v1 WebView shell (Android)

**Goal:** ship a minimal app wrapping the validated web GUI.

- [ ] Android app skeleton (Kotlin, single Activity + `WebView`).
- [ ] `WebViewClient` for HTTPS to the tailnet origin; cookie persistence via `CookieManager`.
- [ ] First-run auth (load token URL once) + a manual "re-authenticate" action.
- [ ] Long cookie lifetime (set `cookieMaxAgeDays` via config if available, else accept default and rely on manual re-auth).
- [ ] App icon, splash, and a simple settings screen (tailnet origin, re-auth button).

**Effort:** ~2–4 days. **Exit criteria:** app on the phone = same experience as the browser, with an app icon and re-auth affordance.

> Note: v1 delivers secure access + conversation history via the wrapped web GUI, but **not** workspace/GitHub selection. That requires v2.

## Phase 2 — v2 `dsh-remote-bridge` plugin (harness side)

**Goal:** the reusable plugin exposing the stable `/mobile/*` API.

- [ ] Plugin package skeleton registered in a DSH composition (host or a dedicated preset).
- [ ] Session routes: list + load (`session-query`), new/resume.
- [ ] Prompt + SSE streaming route; approvals route.
- [ ] Workspace routes: list/set cwd; `git clone` on the Mac (inherits Mac Git credentials).
- [ ] Device auth: pairing + `POST /mobile/auth/token` cookie re-issue via `connection.authenticatedUrl()`.
- [ ] Config schema (workspace roots, cookie lifetime, device keys), validation, docs, tests.

**Effort:** ~2–3 weeks. **Exit criteria:** a second device (or curl over Tailscale) can list sessions, stream a prompt, and re-issue a cookie against the documented API.

## Phase 3 — v2 native Compose client

**Goal:** the Claude-Code-like native app over the bridge.

- [ ] Networking layer (OkHttp + SSE) and models for sessions/messages.
- [ ] Sessions screen (conversation list = history).
- [ ] Chat screen with streaming output.
- [ ] Approvals UI (approve/reject cards).
- [ ] Workspace picker (local folder browse + GitHub clone).
- [ ] Auth + Keystore + silent re-auth UX.
- [ ] Error/offline states, polish, release build.

**Effort:** ~3–5 weeks. **Exit criteria:** full requirements (FR1–FR6) met natively.

## Phase 4 — Optional / deferred

- [ ] Push notifications (FCM/APNs) — a small relay, only if wanted.
- [ ] iOS build (see ADR-002) — Flutter or SwiftUI client against the same bridge.
- [ ] Multi-device / shared-tailnet ACLs and docs for other DSH users.

## Suggested sequencing

Phase 0 → Phase 1 (validate + usable MVP fast) → Phase 2 → Phase 3 → Phase 4.
The bridge (Phase 2) is the cross-platform asset: whichever client framework is chosen later, it does not change.
