# 04 — Decisions (ADR)

## ADR-001 — Ship a WebView shell (v1) before a native client (v2)

**Decision:** v1 is a thin Android WebView around the existing web GUI; v2 is a native Compose client over a bridge API.

**Why:** validates the entire Tailscale + auth + harness path in days, not weeks, and the owner explicitly accepted this de-risking order. The WebView shell is small enough that little work is thrown away.

**Trade-off:** v1 cannot deliver workspace/GitHub selection (not in the web GUI) or a native conversation-list UX; those arrive in v2.

## ADR-002 — Android-native (Kotlin/Compose) now; defer Flutter/iOS

**Decision:** build the client in Kotlin + Jetpack Compose for Android first. Do **not** adopt Flutter now for iOS. Keep the bridge API as the cross-platform contract so a Flutter/SwiftUI client can be added later without touching the harness.

**Context:** owner has only an Android phone (Honor Pro 400, Android 13/14) and an iPad — no iPhone. Wants to possibly open-source for iOS users later.

**Why not Flutter now:**
- The only test device for phone form-factor is Android; the iPad gives no iPhone signal. iOS development also requires an Apple Developer account (~$99/yr) and macOS/Xcode, and iPad-only testing leaves the phone UX unverified.
- The largest reusable asset is the **bridge plugin, which is framework-agnostic** — the framework choice affects only the client half.
- v1 is a WebView shell; its cost is near-zero in either framework, so the Flutter decision is really a **v2** decision that can be made later with more information.
- Flutter adds platform-channel work anyway for the parts that matter here (Tailscale VPN interop, Keystore, notifications, SSE).

**Revisit trigger:** if iOS support becomes a real, near-term goal (an iPhone is available, or the owner is already productive in Dart/Flutter), re-open this decision at Phase 3.

### Effort estimate

| Work | Framework | Estimate (1 dev) |
|---|---|---|
| Phase 0 (Tailscale + serve validation) | n/a | 0.5–1 day |
| Phase 1 (v1 WebView shell) | Kotlin | 2–4 days |
| Phase 2 (bridge plugin) | harness (framework-agnostic) | 2–3 weeks |
| Phase 3 (v2 native client) | Kotlin/Compose | 3–5 weeks |
| Phase 3 in Flutter instead | Flutter | +30–50% on the client half (≈ +1–2.5 weeks), plus iOS setup: Apple account, Xcode, iPad-only testing gap, APNs if notifications are added |
| Phase 4 (notifications) | either | 2–5 days (plus FCM/APNs setup) |

**Bottom line:** Flutter now would cost roughly +30–50% on the client and add real iOS overhead for an audience the owner does not have yet, while the bridge already makes "add iOS later" cheap. Recommend **Kotlin/Compose now, Flutter as a later, reversible choice.**

## ADR-003 — Bridge plugin, not the web app's private RPC

**Decision:** the app targets a purpose-built `/mobile/*` API exposed by a reusable harness plugin, rather than reverse-engineering the web GUI's private Typert `/api` + `/api/remote.mux` contract.

**Why:** the web app's internal RPC is version-coupled and undocumented; a bridge gives a stable, documented surface and centralizes cross-cutting concerns (device auth, workspace, Git) in one place.

## ADR-004 — SSE for streaming

**Decision:** use Server-Sent Events (`GET /mobile/stream`) for streaming responses/events, not a custom WebSocket.

**Why:** the harness's gzip middleware already special-cases `text/event-stream`; OkHttp consumes SSE without a WebSocket client; it works cleanly through `tailscale serve`. WebSocket remains an option if bidirectional client→server signaling is later needed.

## ADR-005 — GitHub credentials live on the Mac, not the app

**Decision:** GitHub access is delegated to the Mac's own `git` (SSH agent / macOS keychain / credential helper). The bridge shells out to `git clone`; the app never stores GitHub tokens.

**Why:** the owner hasn't configured GitHub auth yet and owns only private repos; this keeps secrets on the trusted host and matches how DSH already operates (it acts on the Mac's filesystem).

## ADR-006 — Data stays in `~/.dsh`

**Decision:** the bridge reads/writes the harness's standard `$DSH_HOME` session store (no separate mobile database).

**Why:** owner requires parity with the PC/web app ("all data goes in the same place"). The bridge wraps `session-query`/persistence rather than duplicating it.
