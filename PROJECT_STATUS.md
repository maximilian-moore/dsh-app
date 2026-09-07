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
| `dsh-remote-bridge` plugin | Source (harness) | ⏳ Scaffolding & core setup |
| `DSH Remote` PWA client | Source (client) | ⏳ Baseline app shell & PWA assets |

## 4. Current status

- ✅ **Documentation updated** — PWA-first architecture, Web Push, and multi-layered security/revocation captured.
- ✅ **Phase 0 validated** — Tailscale + `tailscale serve` verified with Honor Pro 400 over HTTPS.
- 🔄 **Checkpoint 1 in progress** — Monorepo workspace, `dsh-remote-bridge` plugin skeleton, and PWA client baseline assets.

## 5. Environment facts (from the owner)

| Area | Fact |
|---|---|
| PC | MacBook Pro, macOS, personal machine, left running/reachable continuously |
| Tailscale | Phone + Mac on the **same personal (free) tailnet**; `tailscale serve` HTTPS accepted; **Tailscale SSH not enabled** |
| Phone | Honor Pro 400, Android 13/14 (iPad exists; works automatically via PWA) |
| DSH data | Default `~/.dsh` — read/write the **same** store the web app uses; no separate DB |
| GitHub | Only **private repos the owner owns**; Mac-side GitHub auth **not yet configured**; app must never handle GitHub secrets |
| Push Notifications | Web Push API via Service Worker + VAPID (Android Chrome native) |
| iOS / iPad | Supported via Safari PWA add-to-home-screen |

## 6. Decisions already made (do not re-litigate without a reason)

1. **PWA-first with Web Push, no native Kotlin/Compose app needed** — ADR-007.
2. **Multi-layered security & instant device revocation** (Tailscale kill-switch + token/push revocation) — ADR-008.
3. **Purpose-built bridge plugin**, not reverse-engineering the web app's private RPC — ADR-003.
4. **SSE** for streaming (the harness already special-cases `text/event-stream`) — ADR-004.
5. **GitHub credentials live on the Mac** (`git clone` via the Mac's git); the app never stores them — ADR-005.
6. **Data stays in `~/.dsh`** (parity with the web app) — ADR-006.

## 7. Next steps (in order)

1. **Phase 0** — ✅ Validated Tailscale + `tailscale serve` over HTTPS.
2. **Phase 1** — PWA baseline & Web Push enablement (Checkpoint 1 & 2).
3. **Phase 2** — `dsh-remote-bridge` plugin & mobile-first UI (Checkpoint 3 & 4).
4. **Phase 3** — Workspace picker & GitHub clone (Checkpoint 5).
5. **Phase 4** — Polish & hardening (Checkpoint 6).

## 8. Resume in a new session

Paste the block below into a fresh session to re-orient without re-reading this whole history:

> We're building **DSH Remote** (repo `maximilian-moore/dsh-app`, local `/Users/max/Documents/DevProjects/dsh-app`): control a DeepSeek Harness on a home Mac from an Android phone (and iPad) over Tailscale using a Progressive Web App (PWA) with native Web Push. Read `PROJECT_STATUS.md` first, then `docs/01-requirements.md` through `docs/04-decisions.md`. Current state: Phase 0 validated; Checkpoint 1 (scaffolding & PWA baseline) implemented. Next is Checkpoint 2 (Web Push integration).

## 9. Open items / blockers

- **Repo push auth (one-time):** this environment has no GitHub credentials; the owner must provide a Personal Access Token (or authenticate the `gh` CLI) to push and open the PR. Not a project blocker, just a setup step.
- **GitHub repo-clone auth on the Mac** (for the workspace/GitHub feature): deferred to Phase 3; design assumes the Mac's existing `git` credentials (SSH agent / keychain / credential helper).
