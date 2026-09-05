# DSH Remote

Control a DeepSeek Harness (DSH) instance running on a home PC, from a phone, over a secure Tailscale connection.

> **New here? Start with [PROJECT_STATUS.md](PROJECT_STATUS.md)** — it's the handoff/resume guide with current status, decisions, and next steps.

**Repository:** https://github.com/maximilian-moore/dsh-app

## What's here

1. **`dsh-remote-bridge`** (Phase 2) — a reusable DeepSeek Harness Host plugin that exposes a small, stable "mobile" API (session list / conversation history, streaming, approvals, workspace + GitHub clone, device auth) on top of the harness's existing services. Designed so **any** DSH user can drop it into their composition.
2. **`DSH Remote`** (Phase 1/3) — the client app (Android first; v1 WebView shell, then v2 native Kotlin/Compose).

## Status

- [x] Requirements — [docs/01-requirements.md](docs/01-requirements.md)
- [x] Architecture — [docs/02-architecture.md](docs/02-architecture.md)
- [x] Roadmap — [docs/03-roadmap.md](docs/03-roadmap.md)
- [x] Decisions + effort — [docs/04-decisions.md](docs/04-decisions.md)
- [ ] Phase 0: Tailscale + `tailscale serve` validation
- [ ] Phase 1: v1 WebView shell
- [ ] Phase 2: v2 `dsh-remote-bridge` plugin
- [ ] Phase 3: v2 native client

## Documents

| Doc | Purpose |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Single-file handoff: what we're building, artifacts, status, decisions, next steps, resume prompt. |
| [docs/01-requirements.md](docs/01-requirements.md) | Problem, functional + non-functional requirements, and the concrete environment facts. |
| [docs/02-architecture.md](docs/02-architecture.md) | End-to-end architecture (v1 WebView shell + v2 bridge/native client), transport, auth/re-auth, workspace/GitHub model, security, reusability. |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Phased build plan with deliverables and rough effort. |
| [docs/04-decisions.md](docs/04-decisions.md) | Architecture Decision Records, incl. the Flutter vs Android-native decision and effort estimate. |
