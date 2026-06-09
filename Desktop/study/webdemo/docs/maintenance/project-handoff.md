# Smart Home System Handoff

Last updated: `2026-06-09`

## Current Goal

Build a web-first smart home management MVP with this control path:

`Next.js dashboard -> backend DeviceBackend -> ESP32S3 -> UART -> STM32H743 -> ack/telemetry ingest -> dashboard`

The app is currently runnable with the in-memory backend. Supabase, Android packaging, and real ESP32S3/STM32H743 firmware remain integration work, not completed delivery.

## Read First

1. `AGENTS.md`
2. `docs/maintenance/project-handoff.md`
3. `docs/maintenance/task-board.md`
4. `docs/maintenance/progress-log.md`
5. `docs/hardware/integration-guide.md`
6. `docs/protocols/smart-home-mvp-device-contract.md`

## Current System

- Frontend: Next.js App Router PWA under `apps/web`
- Backend abstraction: `DeviceBackend`, defaulting to `InMemoryDeviceBackend`
- Planned persistent backend: Supabase schema, RLS policies, edge function skeleton, and server backend implementation are present but need authenticated project setup
- Device contract: shared package under `packages/device-contract`
- Hardware bridge contract: UART and HTTP ingest/downlink documented in `docs/hardware` and `docs/protocols`

## Working Features

- Dashboard shell, mobile bottom navigation, PWA manifest, service worker, offline recovery page
- Homes health snapshot with refresh feedback
- Device list with search, type/status filters, favorites, saved views, CSV/JSON export
- Device detail with command control, cooldown, command lifecycle display, command history
- Activity log with filters, saved views, CSV export
- Settings center with local preferences, notification rules, notification inbox, push readiness checks, local backup export/restore, per-key restore validation for known local state, persisted device maintenance state, and a reset path back to the default device list
- Device ingest endpoint with optional `X-Device-Token`
- Command API with simulator mode and `SMART_HOME_COMMAND_DELIVERY=polling` for ESP32S3 pending-command polling
- Desired state and reported state are kept separate; `delivered` means ESP32S3 has fetched the command, not that STM32H743 has acknowledged execution

## Routes

| Route | Purpose |
| --- | --- |
| `/` | dashboard entry and quick actions |
| `/homes` | whole-home health snapshot |
| `/devices` | device inventory, favorites, filters, export |
| `/devices/[deviceId]` | device state, control panel, command history |
| `/activity` | logs, filters, export |
| `/settings` | preferences, notifications, local backup, device maintenance |
| `/offline` | PWA offline recovery |

## APIs

| Route | Purpose |
| --- | --- |
| `POST /api/devices/[deviceId]/commands` | queue a device command |
| `GET /api/devices/[deviceId]/commands?pending=true` | ESP32S3 polling downlink |
| `POST /api/devices/[deviceId]/ingest` | device ack and telemetry ingest |
| `POST /api/system/lifecycle-tick` | command lifecycle sweep |
| `GET /api/homes/snapshot` | homes health aggregation |

## Cleanup Policy

- Keep source tests that protect current behavior. They are not disposable artifacts.
- Do not keep Playwright screenshots, trace files, reports, `.next`, `coverage`, temp scripts, local DB files, or `.omx` state.
- `.gitignore` covers dependency folders, build/cache output, browser test reports, `blob-report`, `*.tsbuildinfo`, local DB files, package-manager debug logs, and OMX state.
- Production e2e tests no longer write `output/qa-*.png`; use screenshots only for a specific visual investigation and delete them after.
- Old Superpowers plan/spec files were removed because current handoff, task board, hardware docs, and protocol docs replace them.
- When the machine is memory-constrained, run full Vitest separately from build/lint and use `npm test -- --run --maxWorkers=1`.

## Latest Verification

- 2026-06-09 local backup restore hardening: targeted helper tests passed for backup, device filters, activity filters, notification inbox, push sync, and user preferences; full `npm test -- --run --maxWorkers=1` passed, 26 files / 124 tests; `npm run lint` passed; `npm run build` passed. Restore planning now validates known local-state schemas before writing to `localStorage`; `apps/web/.next/` was deleted after build.
- 2026-06-09 cleanup follow-up: `git status -sb --ignored` showed no tracked dirt and only ignored `node_modules/`; recursive scan found no `.next`, `test-results`, `playwright-report`, `coverage`, `blob-report`, `output`, `.playwright-mcp`, `.omx`, temp backup files, trace files, HAR files, or TS build info artifacts. `.gitignore` was tightened for future build/test caches and package-manager debug logs.
- 2026-06-09 device-maintenance backup restore validation: targeted helper tests passed, full `npm test -- --run --maxWorkers=1` passed, 26 files / 122 tests; `npm run lint` passed; `npm run build` passed; direct `node ./node_modules/@playwright/test/cli.js test tests/e2e/prod-shell.spec.ts` passed, 15 tests. Build and e2e artifacts were deleted after verification.
- 2026-06-09 settings device maintenance reset: `npm test -- --run` passed, 26 files / 120 tests; `npm run lint` passed; `npm run build` passed; `playwright test tests/e2e/prod-shell.spec.ts` passed, 15 tests; desktop/mobile no-output smoke verified reset dialog and final state without horizontal overflow. Build and e2e artifacts were deleted after verification.
- 2026-06-09 settings device maintenance persistence: `npm test -- --run` passed, 26 files / 119 tests; `npm run lint` passed with no warnings; `npm run build` passed; `playwright test tests/e2e/prod-shell.spec.ts` passed, 15 tests. Build and e2e artifacts were deleted after verification.
- 2026-06-09 cleanup verification: `npm test -- --run` passed, 25 files / 114 tests; `npm run lint` passed; `npm run build` passed; `playwright test tests/e2e/prod-shell.spec.ts` passed, 15 tests.
- 2026-06-09 cleanup artifact check: no `.next`, `coverage`, `test-results`, `playwright-report`, `output`, `.playwright-mcp`, or `.omx` directory remained after verification; port 3000 was stopped.
- 2026-06-09 previous settings confirmation slice: targeted `settings-page.test.tsx`, full Vitest, lint, build, and rendered `/settings` smoke passed; `.next` was deleted after build.
- Current workspace check before cleanup: no tracked dirt; ignored only `node_modules/`.

Run after any substantive change:

```bash
npm test -- --run
npm run lint
npm run build
```

Delete `apps/web/.next/` after build unless the user is actively running the production server.

## Current Blockers

- GitHub MCP credentials return `Bad credentials`; use GitHub MCP first, then GitHub CLI Git Data API fallback if MCP still fails.
- Native `git push` has been unreliable from this environment.
- Supabase work needs `SUPABASE_ACCESS_TOKEN` or CLI login plus project linking.
- Android APK work needs Android SDK / Gradle toolchain.
- Real hardware validation needs ESP32S3/STM32H743 firmware and device token configuration.

## GitHub Publication

- Remote repo: `2456018331lby-dev/webdemo`
- Remote branch: `hermeswork`
- Remote subtree: `Desktop/study/webdemo/`
- Verified working publication path: GitHub CLI Git Data API fallback with non-forced ref update
- Local branch: `main`

Use Lore-style commit messages with trailers. Keep commits scoped and reviewable.

## Next Useful Work

1. Fix GitHub MCP credentials so publication can use the requested MCP path.
2. Add account/backend migration for settings-device state after Supabase linking, keeping local state as an import/export fallback.
3. Link Supabase and run migrations, then smoke test `SMART_HOME_BACKEND=supabase`.
4. Implement ESP32S3 pending-command polling and `X-Device-Token` handling on firmware.
5. Configure Web Push VAPID key and persist subscriptions server-side.
