# DSH Remote

Control a DeepSeek Harness (DSH) instance running on a home PC, from a phone, over a secure Tailscale connection.

> **New here? Start with [PROJECT_STATUS.md](PROJECT_STATUS.md)** — it's the handoff/resume guide with current status, decisions, and next steps.

**Repository:** https://github.com/maximilian-moore/dsh-app

## What's here

1. **`dsh-remote-bridge`** — a reusable DeepSeek Harness Host plugin (`packages/bridge`) that hooks `ctx.webServer.tapIndex()` to inject a mobile responsiveness layer into the official DSH Web App, mints signed `SameSite=Lax` cookies for zero-token browser/PWA authentication, and exposes the `/mobile` PWA endpoints.
2. **`DSH Remote Mobile Enhancer`** — injected client assets (`dsh-mobile-enhancer.css` and `dsh-mobile-enhancer.js`) providing:
   - Sliding hamburger drawer with session history.
   - Dynamic top section dropdown (*General*, *Models*, *Agent Presets*, *Plugins*) for Settings.
   - Smooth, hardware-accelerated touch-momentum scrolling for all settings options.
   - Auto-expanding sidebar controls without collapsed rail trapping.
3. **`DSH Remote PWA`** (`packages/client`) — installable Progressive Web App with standalone manifest, cache-busting service worker, and mobile-first layout.

## Status

- [x] Requirements — [docs/01-requirements.md](docs/01-requirements.md)
- [x] Architecture — [docs/02-architecture.md](docs/02-architecture.md)
- [x] Roadmap — [docs/03-roadmap.md](docs/03-roadmap.md)
- [x] Decisions + effort — [docs/04-decisions.md](docs/04-decisions.md)
- [x] Phase 0: Tailscale + `tailscale serve` validation
- [x] Phase 1: PWA baseline + installability (Android Chrome WebAPK & iOS/iPad Safari)
- [x] Phase 2: `dsh-remote-bridge` plugin & official DSH mobile responsiveness layer
- [ ] Phase 3: In-browser remote workspace directory picker & GitHub clone integration

## Known Limitations

- **Remote Workspace Directory Picker**: Selecting a new directory from a mobile browser or PWA triggers the host browser/OS native folder picker dialog (via the File System Access API or input dialog), which opens on the host PC rather than on the phone. Workspaces currently need to be created or opened on the host machine; mobile sessions can then select among any pre-existing workspaces. Remote directory tree navigation and creation directly in the web UI will be addressed in Phase 3.

## Documents

| Doc | Purpose |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Single-file handoff: what we're building, artifacts, status, decisions, next steps, resume prompt. |
| [docs/01-requirements.md](docs/01-requirements.md) | Problem, functional + non-functional requirements, and the concrete environment facts. |
| [docs/02-architecture.md](docs/02-architecture.md) | End-to-end architecture (v1 WebView shell + v2 bridge/native client), transport, auth/re-auth, workspace/GitHub model, security, reusability. |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Phased build plan with deliverables and rough effort. |
| [docs/04-decisions.md](docs/04-decisions.md) | Architecture Decision Records, incl. the Flutter vs Android-native decision and effort estimate. |

