# Task Board

Last updated: `2026-06-09`

## Current Delivery State

The web-first MVP is usable with the in-memory backend. It includes the PWA shell, device dashboard, command lifecycle UI, device ingest/downlink APIs, settings center, notification inbox, local backup/restore, and hardware-facing contracts.

The repository should stay lean:

- Keep regression tests that protect current behavior.
- Do not keep generated screenshots, traces, reports, `.next`, coverage, temp scripts, local DBs, or `.omx` state.
- Keep maintenance docs short enough for the next agent to read before editing.

## Completed Capability Groups

- [x] Next.js dashboard routes: `/`, `/homes`, `/devices`, `/devices/[deviceId]`, `/activity`, `/settings`, `/offline`
- [x] PWA install/offline surface: manifest, service worker, mobile shell, offline recovery
- [x] Device control lifecycle: command queueing, cooldown, polling delivery state, failed/timed-out unlock behavior
- [x] Device ingest and downlink APIs with device token support
- [x] Device favorites, filters, saved views, and exports
- [x] Activity filters, saved views, and CSV export with formula-injection protection
- [x] Settings center: local preferences, notifications, push readiness, notification inbox, backup export/restore, validated device-maintenance restore, persisted device maintenance, reset to default device list
- [x] Hardware and protocol documentation for ESP32S3, STM32H743, UART, ingest, ack, and telemetry
- [x] Supabase schema, RLS policies, edge function skeleton, and server backend implementation
- [x] Regression coverage: 114 Vitest tests before this cleanup
- [x] Workspace hygiene: old Superpowers plan/spec removed; e2e screenshot output disabled; cleanup verification passed

## Active Backlog

### Cleanliness

- [x] Remove unreferenced old planning artifacts under `docs/superpowers`
- [x] Remove Playwright screenshot writes from production e2e tests
- [x] Compress handoff/task-board docs to current-state summaries
- [x] Current cleanup removed `.next` and `test-results` after verification
- [ ] Keep future build/smoke runs from leaving `.next`, reports, screenshots, or temp files

### App Logic

- [x] Persist `/settings` device maintenance edits across browser sessions
- [x] Include persisted device maintenance state in local backup/restore
- [x] Add focused regression tests for settings device maintenance persistence
- [x] Add a settings-device reset action that clears local maintenance overrides back to seed devices
- [x] Validate settings-device backup restore values before writing them to `localStorage`
- [ ] Plan Supabase/account migration for settings-device local state once backend auth is available

### Hardware

- [ ] ESP32S3: WiFi connection and HTTP ingest
- [ ] ESP32S3: `X-Device-Token` configuration and request header
- [ ] ESP32S3: poll `GET /api/devices/[deviceId]/commands?pending=true`
- [ ] ESP32S3: encode queued commands to UART
- [ ] STM32H743: UART receive, GPIO control, ack/telemetry frame generation
- [ ] End-to-end hardware smoke with one relay device

### Backend

- [ ] Restore GitHub MCP credentials
- [ ] Restore reliable native git transport or keep using Git Data API fallback
- [ ] Provide Supabase auth token or CLI login
- [ ] Link Supabase project and push migrations
- [ ] Run `SMART_HOME_BACKEND=supabase` smoke test
- [ ] Add auth flow and account-scoped device state
- [ ] Persist push subscriptions and notification history server-side

### Packaging / Ops

- [ ] Install Android SDK / Gradle if APK output is required
- [ ] Choose Capacitor or TWA/PWABuilder packaging path
- [ ] Complete Android device/emulator smoke
- [ ] Deploy to Vercel or Netlify
- [ ] Add Sentry or equivalent monitoring
