# 04 — Decisions (ADR)

## ADR-001 — [SUPERSEDED by ADR-007] Ship a WebView shell (v1) before a native client (v2)

*Superseded by ADR-007: Shifted to a PWA-first architecture.*

## ADR-002 — [SUPERSEDED by ADR-007] Android-native (Kotlin/Compose) now; defer Flutter/iOS

*Superseded by ADR-007: Shifted to a PWA-first architecture.*

### Effort estimate (PWA vs Native)

| Work | Approach | Estimate (1 dev) |
|---|---|---|
| Phase 0 (Tailscale + serve validation) | Tailscale + DSH web | 0.5–1 day |
| Phase 1 (PWA enablement + Web Push) | Web App Manifest + Service Worker + VAPID | 1–2 days |
| Phase 2 (Mobile-first UI + Bridge plugin) | Lightweight PWA frontend + `/mobile/*` API | 3–5 days |
| Phase 3 (Hardening & Git/Workspace) | Workspace boundaries + Git clone workflow | 2–3 days |
| *Total effort to fully working mobile solution:* | **PWA-first** | **~1–2 weeks** (vs. 5–8 weeks for native Compose) |

**Bottom line:** A PWA installed from Chrome on Android (WebAPK) provides ~90% of native app feel, full-screen standalone UI, native Web Push notifications via Service Worker, and instant updates with zero release cycles. It also runs immediately on the iPad.

## ADR-003 — Bridge plugin, not the web app's private RPC

**Decision:** the app targets a purpose-built `/mobile/*` API exposed by a reusable harness plugin, rather than reverse-engineering the web GUI's private Typert `/api` + `/api/remote.mux` contract.

**Why:** the web app's internal RPC is version-coupled and undocumented; a bridge gives a stable, documented surface and centralizes cross-cutting concerns (device auth, workspace, Git) in one place.

## ADR-004 — SSE for streaming

**Decision:** use Server-Sent Events (`GET /mobile/stream`) for streaming responses/events, not a custom WebSocket.

**Why:** the harness's gzip middleware already special-cases `text/event-stream`; browser `EventSource` or fetch streams consume SSE natively; it works cleanly through `tailscale serve`.

## ADR-005 — GitHub credentials live on the Mac, not the app

**Decision:** GitHub access is delegated to the Mac's own `git` (SSH agent / macOS keychain / credential helper). The bridge shells out to `git clone`; the app never stores GitHub tokens.

**Why:** the owner hasn't configured GitHub auth yet and owns only private repos; this keeps secrets on the trusted host and matches how DSH already operates (it acts on the Mac's filesystem).

## ADR-006 — Data stays in `~/.dsh`

**Decision:** the bridge reads/writes the harness's standard `$DSH_HOME` session store (no separate mobile database).

**Why:** owner requires parity with the PC/web app ("all data goes in the same place"). The bridge wraps `session-query`/persistence rather than duplicating it.

## ADR-007 — PWA-first architecture with Web Push

**Decision:** Build the mobile client as a Progressive Web App (PWA) served over Tailscale HTTPS instead of building a native Kotlin/Compose or Flutter app. Web Push notifications are handled via the W3C Web Push API (Service Worker + VAPID) rather than Firebase Cloud Messaging (FCM).

**Why:**
- **Zero release cycle & instant updates:** Any change to frontend code on the Mac is live upon reload. No APK compiling, sideloading, or Play Store review.
- **Native feel on Android:** Installed via Chrome on Android, the PWA generates a WebAPK with its own launcher icon, full-screen standalone window (no address bar), theme colors, and recent apps entry.
- **Web Push works natively:** Chrome on Android supports W3C Web Push without Google Play Services native code or FCM console configuration.
- **Cross-platform for free:** Runs on both the Honor Pro 400 and the iPad without platform-specific code.
- **Time savings:** Reduces client delivery time from ~4–6 weeks down to ~3–5 days.

## ADR-008 — Multi-layered security and instant device revocation

**Decision:** Rely on a 3-layer defense-in-depth model:
1. **Network Layer (Tailscale Zero Trust):** Tailnet WireGuard tunnel + `tailscale serve` TLS. No public ports; no `tailscale funnel`.
2. **Application Layer (Cookie / Device Pairing Token):** Signed browser cookies minted from a process launch token or device authorization token.
3. **Storage & Execution Boundaries:** Workspace roots are restricted to whitelisted directories (e.g. `~/DevProjects`); commands cannot execute outside authorized boundaries without explicit approval.

**Lost Phone Revocation Protocol:**
- **Instant Kill-Switch (Network):** If the phone is lost, remove or disable `honor-400-pro` in the [Tailscale Admin Console](https://login.tailscale.com/admin/machines). Access is cut off immediately at the WireGuard packet level.
- **Application Revocation:** Remove the device token from `~/.dsh/paired_devices.json` or restart `dsh web` (and rotate cookie secret in `~/.dsh`) to invalidate all existing cookies.
- **Push Revocation:** Remove the phone's Web Push subscription from the server database, terminating notification delivery.
