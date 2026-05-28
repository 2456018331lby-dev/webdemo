# Project Operating Notes

## Primary rule

Execute the task directly. Do not stop after planning if the next step is clear and low risk.

## Mandatory maintenance updates

After every substantive change, update these files before handoff or completion:

1. `docs/maintenance/project-handoff.md`
2. `docs/maintenance/progress-log.md`
3. `docs/maintenance/task-board.md`

## Documentation contract

- `docs/maintenance/project-handoff.md` — canonical current-state summary
- `docs/maintenance/progress-log.md` — append-only chronological history
- `docs/maintenance/task-board.md` — live prioritized backlog
- `docs/hardware/integration-guide.md` — 硬件集成接入指南（面向后续 AI 和硬件工程师）
- `docs/protocols/smart-home-mvp-device-contract.md` — UART 协议详细定义
- Do not leave critical status only in chat.

## Delivery context

This repository is building a smart home management system with:

- `STM32H743` for deterministic device-side control
- `ESP32S3` for connectivity, WiFi, BLE, and bridge logic
- `Next.js` web app for dashboard and control UI
- planned `Supabase` backend for auth, database, ingest, and realtime

## Current expectations

- Preserve the existing MVP control loop unless intentionally expanding it.
- Prefer TDD for feature work.
- Keep desired state and reported state separate.
- Hardware integration entry point: `docs/hardware/integration-guide.md`
- Device ingest endpoint: `POST /api/devices/[deviceId]/ingest`

## Key architectural decisions

- web-first MVP, not native-app first
- UART is the first ESP32S3 ↔ STM32H743 bridge
- desired state and reported state stay separate
- contract-first message shape between app, backend, and firmware
- simulator path exists before real hardware coupling
- persistence path behind replaceable server interfaces (DeviceBackend)