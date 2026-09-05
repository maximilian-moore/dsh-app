# 02 — Architecture

## 1. Overview

The harness already provides everything the web app uses: a durable session store, a session-query service, the agent runtime, and cookie auth. The architecture keeps that server loopback-only and puts Tailscale in front of it. The client is built in two stages:

- **v1 — WebView shell**: a thin Android app wrapping the existing web GUI. Zero harness changes; validates the whole network + auth path fast.
- **v2 — Mobile Bridge + native client**: a reusable harness plugin (`dsh-remote-bridge`) exposes a small stable API; a native Compose client implements the Claude-Code-like experience (native conversation list, streaming, approvals, workspace/GitHub).

```
┌────────────────────────────────────────────────────────────────────────┐
│  Mac at home (always on)                                               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  DeepSeek Harness  (dsh web)  — loopback 127.0.0.1:3080         │  │
│  │                                                                  │  │
│  │   session store ── session-query ──►  web GUI (SPA)             │  │
│  │   (JSONL, ~/.dsh)                      ▲                        │  │
│  │   agent runtime                        │  v2                     │  │
│  │   BrowserAuth / connection  ──►  dsh-remote-bridge plugin       │  │
│  │                                     │  /mobile/* routes          │  │
│  │                                     │  + SSE stream              │  │
│  │                                     │  + device auth             │  │
│  │                                     │  + workspace / git clone   │  │
│  └─────────────────────────────────────┼────────────────────────────┘  │
│                         Tailscale (tailscaled) + tailscale serve        │
└─────────────────────────────────────────┼──────────────────────────────┘
                                          │  WireGuard + HTTPS (tailnet-only)
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  Phone                                        │
                    │  - Tailscale app (system VPN)                 │
                    │  v1: WebView shell → web GUI                  │
                    │  v2: native Compose client → /mobile/*        │
                    └─────────────────────────────────────────────┘
```

## 2. Harness facts this design relies on (verified in source)

- The web server binds **loopback only**; `--host 0.0.0.0` is intentionally rejected ("would expose remote code execution"). Do not try to bind it wider.
- Auth = a **launch token** in the boot URL that mints a **signed, authority-bound cookie**; everything else is 401. The signing secret is persisted in `~/.dsh`, so the cookie survives PC restart; the launch token is per-process.
- The `/api` surface has a **browser-trust fence** (DNS-rebinding protection). A non-loopback `Host` must be declared via `--trusted-host <authority>`.
- Conversation list + history come from `session-query` (`listSessions`, `load`) over the JSONL persistence — the same store the web app shows.
- The server's gzip middleware already special-cases `text/event-stream`, so **SSE** is a natural streaming transport.

## 3. Transport

- Harness: `dsh web --trusted-host <mac>.<tailnet>.ts.net` (loopback, port 3080).
- Tailscale: `tailscale serve --bg http://127.0.0.1:3080` → publishes `https://<mac>.<tailnet>.ts.net` to the tailnet only, with a Tailscale-managed TLS cert.
- The phone (Tailscale app VPN) reaches that HTTPS origin directly.

## 4. v1 — WebView shell

A minimal Android app (one Activity + `WebView` + `WebViewClient`):

- Points the `WebView` at `https://<mac>.<tailnet>.ts.net`.
- Persists cookies (the harness cookie) via the system `CookieManager`.
- Handles the first-run auth: load the boot-token URL once to mint the cookie.
- Re-auth: with a long cookie lifetime this is rare; v1 exposes a manual "re-authenticate" action that reloads the token URL. (v2 automates this via the bridge, see §6.)

v1 delivers FR1 (secure transport), FR2 (basic auth), FR3/FR4 (via the web GUI it wraps), but **not** FR5 (workspace/GitHub selection is not in the web GUI) and not a native conversation-list UX.

## 5. v2 — `dsh-remote-bridge` plugin (harness side)

A reusable Host plugin registering routes on the **existing** `webServer` (same port, so `tailscale serve` already fronts it). It wraps harness services, not the web app's private RPC:

| App capability | Bridge endpoint | Backed by |
|---|---|---|
| List conversations | `GET /mobile/sessions` | `session-query.listSessions()` |
| Read one conversation | `GET /mobile/sessions/{id}` | `session-query.load(id)` |
| New / resume session | `POST /mobile/sessions[/{id}]` | session registry / agent services |
| Send prompt + stream | `POST /mobile/sessions/{id}/prompt` + `GET /mobile/stream` (SSE) | agent runtime + session events |
| Approve / reject | `POST /mobile/approvals/{id}` | approval service |
| List / set workspace | `GET|POST /mobile/workspace` | session cwd |
| Clone GitHub repo | `POST /mobile/workspace/clone` | `git clone` on the Mac, then set cwd |
| Device auth / cookie re-issue | `POST /mobile/auth/token` | `connection.authenticatedUrl()` |

### Reusability (FR6)

The plugin is self-contained and configured in the host composition (or a preset), e.g.:

```yaml
- id: dsh-remote-bridge
  config:
    allowedWorkspaceRoots: ["~/DevProjects"]
    cookieMaxAgeDays: 365
    # device keys / pairing established at runtime, stored in ~/.dsh
```

Any DSH user installs the plugin package and adds the row; no fork of harness internals. GitHub credentials are inherited from the Mac's `git` (SSH agent / keychain / credential helper), so the plugin never stores them.

## 6. Auth & re-auth flow (FR2)

**Pairing (once).**
1. The app generates a device keypair/API key and shows a short pairing code.
2. The owner approves it once in the web GUI (or via a bridge config file). The bridge persists the approved device key in `~/.dsh`.
3. The device key is stored in **Android Keystore**.

**Normal use.** The app authenticates with the signed browser cookie (fetched at pairing).

**Silent re-issue (cookie expired / `dsh web` restarted).**
1. App gets `401` → calls `POST /mobile/auth/token` with `Authorization: Bearer <deviceKey>`.
2. Bridge calls `connection.authenticatedUrl(origin)` → returns the **current** process launch token (correct even after restart).
3. App GETs that token URL → server sets a fresh signed cookie and redirects.
4. App stores the new cookie and retries.

Result: **no manual effort after the one-time pairing**, surviving PC restarts. Cookie lifetime is also raised (e.g. 180–365 days) so re-issue is rare.

## 7. Security model

- Harness stays on `127.0.0.1`; only `tailscale serve` (tailnet-only, TLS) fronts it — never `tailscale funnel`.
- Two independent layers: Tailscale membership + harness cookie/device key.
- Device key in Keystore; cookie authority-bound; optional Tailscale ACLs allow only the phone.
- The bridge's device-auth route still sits behind the `/api`-style trust fence (`--trusted-host`), so no DNS-rebinding exposure.
- The app never handles GitHub secrets; Git operations run on the Mac with the Mac's credentials.

## 8. Client (v2) stack

- Kotlin + Jetpack Compose (Android), OkHttp for HTTP + SSE, Android Keystore for the device key.
- Screens: Sessions (list) · Chat (streaming) · Approvals · Workspace picker (local folder / GitHub) · Settings/auth.
- See ADR-002 for the Flutter/iOS consideration.
