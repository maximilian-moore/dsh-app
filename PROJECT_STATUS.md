# Project Status — DSH Remote

> **Read this file first when starting a new session.** It is the single source of truth for what we're building, where everything lives, what's decided, and what's next.

_Last updated: 2026-09-07_

## 1. What we're building

Control a **DeepSeek Harness (DSH)** instance running on a home Mac from a phone, securely over **Tailscale** — with an experience similar to the Claude Code app (conversation history, streaming, approve/reject), plus the ability to connect a session to a **GitHub repo** or a **local folder**.

Two deliverables:

1. **`dsh-remote-bridge`** — a reusable DeepSeek Harness **Host plugin** that exposes a small, stable "mobile" API (conversation list/history, streaming, approvals, workspace + GitHub clone, device auth, Web Push VAPID) on top of the harness's own services. Designed so **any** DSH user can drop it into their composition.
2. **`DSH Remote`** — the client Progressive Web App (PWA). Installed to home screen via Android Chrome (WebAPK) or iPad Safari, with native Web Push notifications for tool approvals.

## 2. Repository & local layout

- **Repo:** https://github.com/maximilian-moore/dsh-app (public, default branch `main`)
- **Local:** `/Users/max/Documents/DevProjects/dsh-app/`

```
dsh-app/
├── PROJECT_STATUS.md        ← you are here (handoff / resume guide)
├── README.md                ← index + doc links
└── docs/
    ├── 01-requirements.md   ← problem, functional + non-functional reqs, environment facts
    ├── 02-architecture.md   ← PWA design, transport, auth/re-auth, Web Push, security & revocation
    ├── 03-roadmap.md        ← phased build plan (Phase 0 → Phase 3) + effort
    └── 04-decisions.md      ← ADRs, incl. PWA-first decision (ADR-007) and security model (ADR-008)
```

## 3. Artifact inventory

| Artifact | Kind | Status |
|---|---|---|
| `docs/01-requirements.md` | Documentation | ✅ Done |
| `docs/02-architecture.md` | Documentation | ✅ Done (Updated to PWA) |
| `docs/03-roadmap.md` | Documentation | ✅ Done (Updated to PWA) |
| `docs/04-decisions.md` | Documentation | ✅ Done (Added ADR-007/008) |
| `README.md`, `PROJECT_STATUS.md` | Documentation | ✅ Done |
| `dsh-remote-bridge` plugin (`packages/bridge`) | Source (harness) | ✅ Done (18 Vitest tests passing) |
| `DSH Remote` PWA client (`packages/client`) | Source (client) | ✅ Done (Manifest, Service Worker, Mobile UI) |
| Mobile Responsiveness Layer (`packages/client/public`) | Enhancer (CSS/JS) | ✅ Done (Drawer, Settings dropdown, touch scroll) |

## 4. Current status

- ✅ **Phase 0 validated** — Tailscale + `tailscale serve` verified over HTTPS.
- ✅ **Phase 1 complete** — PWA baseline, Service Worker cache-busting, and installability (Android Chrome WebAPK & iPad Safari).
- ✅ **Phase 2 complete** — `dsh-remote-bridge` plugin injecting mobile responsiveness layer (`tapIndex`), floating hamburger drawer, zero-token SameSite=Lax auth, Settings top section dropdown (*General*, *Models*, *Agent Presets*, *Plugins*), and hardware-accelerated touch-momentum scrolling.
- 📋 **Phase 3 planned** — Remote in-browser directory tree picker & GitHub clone integration.

## 5. Environment facts

| Area | Fact |
|---|---|
| PC | MacBook Pro, macOS, personal machine, running `dsh web` |
| Tailscale | Phone + Mac on the **same personal tailnet**; `tailscale serve` HTTPS; TLS cert managed by Tailscale |
| Phone | Android 13/14 (Honor 400 Pro) running Chrome & PWA (iPad supported via Safari) |
| DSH data | Default `~/.dsh` — read/write the **same** store the web app uses; no separate DB |
| GitHub | Private repos; credentials live on host machine; app never stores secrets |

## 6. Known limitations

- **Remote Workspace Directory Picker**: Selecting a new directory from a mobile browser or PWA triggers the host browser/OS native folder picker dialog, which opens on the host PC rather than on the phone. Workspaces currently need to be created or opened on the host machine; mobile sessions can then select among any pre-existing workspaces. Remote directory tree navigation and creation directly in the web UI is deferred to Phase 3.

## 7. Decisions already made (do not re-litigate without a reason)

1. **PWA-first with Web Push, no native Kotlin/Compose app needed** — ADR-007.
2. **Multi-layered security & instant device revocation** (Tailscale kill-switch + token/push revocation) — ADR-008.
3. **Purpose-built bridge plugin**, not reverse-engineering the web app's private RPC — ADR-003.
4. **SSE** for streaming (the harness already special-cases `text/event-stream`) — ADR-004.
5. **GitHub credentials live on the Mac** (`git clone` via the Mac's git); the app never stores them — ADR-005.
6. **Data stays in `~/.dsh`** (parity with the web app) — ADR-006.

## 8. Next steps (in order)

1. **Phase 3** — In-browser remote workspace directory tree picker & GitHub repo clone flow.
2. **Phase 4** — Web Push notification triggers for background approval requests.

## 9. Resume in a new session

Paste the block below into a fresh session to re-orient without re-reading this whole history:

> We're building **DSH Remote** (repo `maximilian-moore/dsh-app`): control a DeepSeek Harness on a home Mac from an Android phone (and iPad) over Tailscale using a Progressive Web App (PWA). Read `PROJECT_STATUS.md` first, then `docs/01-requirements.md` through `docs/04-decisions.md`. Current state: Phase 0, 1, and 2 complete (mobile drawer, Settings top dropdown, touch-momentum scrolling, zero-token SameSite=Lax cookie auth). Next is Phase 3 (in-browser remote directory picker).

