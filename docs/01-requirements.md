# 01 — Requirements

## 1. Problem statement

The owner runs DeepSeek Harness (`dsh web`) on a MacBook Pro at home and wants to drive it from a phone while away. The connection must be secure. They want an experience similar to the Claude Code app: see past conversations, continue them, stream responses, and approve or reject agent actions.

## 2. Goals (user-visible outcomes)

1. **Secure remote control** of DSH from a phone, with no public-internet exposure (Tailscale).
2. **Conversation history** — see the same list of conversations the DSH web app shows, open one, and continue it.
3. **Claude-Code-like UX** — session list → tap into a conversation → prompt → streaming output → approve/reject.
4. **Workspace selection** — connect a session either to a GitHub repo (private, owner's own) or to a local folder on the Mac.
5. **Low-friction re-auth** — when the session cookie expires (or the PC/`dsh web` restarts), the app obtains a fresh cookie automatically, with no manual token copy.
6. **Reusable plugin** — the harness-side piece must be reusable by other DSH users ("control my DSH from the go"), not a bespoke one-off.

## 3. Environment facts (captured from the owner)

| Area | Fact |
|---|---|
| Tailscale | Both phone and Mac on the **same personal (free) tailnet**. |
| Tailscale SSH | **Not enabled** on the Mac (avoid `tailscale ssh` / stdio tunnel designs). |
| Tailscale serve | Owner accepts `tailscale serve` HTTPS (tailnet-only TLS). |
| PC | MacBook Pro, macOS. Personal machine, **no VPN/firewall/corporate network**. |
| PC availability | PC will be left running/reachable continuously. |
| Phone | Honor Pro 400, **Android 13 or 14**. |
| Push notifications | "Nice to have, not needed" for v1 — defer. |
| iOS | No iPhone; an iPad is available. iOS support deferred (see ADR-002). |
| DSH data | Default `$DSH_HOME` (`~/.dsh`) — the app must read/write the **same** data the PC/web app uses; no separate store. |
| GitHub | Only **private repos the owner owns**. GitHub auth is **not yet configured** on the Mac; will be set up later. The app must not handle GitHub secrets itself. |
| App build order | Owner is fine to ship a **WebView shell first (v1)**, then a fully native Compose UI (v2) if v1 doesn't meet the requirements. |

## 4. Functional requirements

### FR1 — Secure transport
- FR1.1 The harness must stay bound to loopback; no public/LAN port exposure.
- FR1.2 The phone reaches the harness exclusively over the tailnet via `tailscale serve` (HTTPS).
- FR1.3 (Optional, recommended) Tailscale ACLs restrict access to the Mac's serve port to the phone.

### FR2 — Authentication & re-auth
- FR2.1 First-run **pairing** binds the app to the harness (one-time).
- FR2.2 The app authenticates with the harness's own signed browser cookie.
- FR2.3 When the cookie is missing/expired/invalid (including after a `dsh web` restart), the app re-issues a cookie **without manual token copying**.

### FR3 — Conversation history
- FR3.1 List the owner's conversations (same set the web app shows).
- FR3.2 Open a conversation and view its messages/events.
- FR3.3 Continue an existing conversation (resume) and start a new one.

### FR4 — Driving the agent
- FR4.1 Send a prompt to a session.
- FR4.2 Stream the response/tool activity as it happens.
- FR4.3 Approve or reject agent actions (tool calls / approvals).

### FR5 — Workspace & GitHub
- FR5.1 Set a session's working directory to a local folder on the Mac.
- FR5.2 "Connect to a GitHub repo": clone (or open an already-cloned) private repo on the Mac and point the session at it. GitHub credentials are the Mac's own (SSH agent / macOS keychain / credential helper); the app never handles them.

### FR6 — Reusability (plugin)
- FR6.1 The harness-side capability ships as a self-contained, configurable DSH plugin usable in any DSH composition.
- FR6.2 Configuration (workspace roots, allowed device(s), cookie lifetime, GitHub behavior) is host-side, not hard-coded.

## 5. Non-functional requirements

- **NFR1 Data locality** — session data stays in `~/.dsh`; the bridge reads the same persistence the web app reads (no copy/fork).
- **NFR2 Security** — defense in depth: Tailscale membership + harness cookie/device key; secrets in Android Keystore.
- **NFR3 Stability** — the app targets the bridge's stable API, not the web app's private internal RPC, so harness upgrades don't break the app.
- **NFR4 Open-source friendliness** — clean, documented plugin contract and app code; MIT-style licensing; no owner-specific secrets in the repo.
- **NFR5 Cost-conscious** — keep v1 minimal; defer notifications and iOS.

## 6. Out of scope for v1 (deferred)

- Push notifications (FCM/APNs).
- iOS build (see ADR-002).
- Multi-user / team tailnets and shared device ACLs.
- Fully native chat UI (v2).
- Standalone public-internet access (explicitly not wanted — Tailscale-only).
