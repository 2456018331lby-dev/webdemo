# Smart Home System MVP Design

## Product Decision

The first release should be a web-first smart home management system with a working hardware control loop, not a full smart-home platform. Phase 1 will prove one complete path from authenticated user action to MCU execution and back to visible state in the dashboard.

The product will use:
- `STM32H743` for deterministic device control, sensor sampling, and actuator safety logic
- `ESP32S3` for WiFi, BLE onboarding, cloud communication, and connectivity-side OTA
- `Next.js App Router` for the web app
- `Supabase` for auth, database, realtime dashboards, and Edge Functions

Native mobile apps, complex automations, and advanced analytics are deliberately deferred.

## MVP Scope

### In Scope

- User authentication
- Homes, rooms, and devices hierarchy
- Device provisioning session flow
- Device list with online or offline state
- Device detail page with latest reported state
- Manual control actions such as relay toggle, brightness set, mode change, or refresh
- Command timeline with pending, acknowledged, failed, and timed-out states
- Recent telemetry view
- Hardware simulator path so frontend and backend can progress before full MCU integration

### Out Of Scope

- Native iOS or Android apps
- Rules engine and multi-step automations
- Voice assistant integrations
- Multi-home enterprise management
- Historical analytics beyond a simple recent telemetry timeline
- Video generation, marketing site, and brand collateral in the MVP build phase

## Primary Users

- Home owner: views homes, rooms, device status, and triggers commands
- Home member: uses granted devices with restricted permissions
- Installer or admin: provisions devices, assigns them to rooms, and validates connectivity

## System Architecture

### Logical Flow

1. User signs in to the web dashboard.
2. User selects a home, room, and device.
3. User submits a command.
4. Backend validates membership and device ownership.
5. Backend stores a command row with a correlation id.
6. ESP32S3 retrieves or receives the command.
7. ESP32S3 converts the command to an internal UART frame.
8. STM32H743 executes the command and returns an acknowledgement.
9. ESP32S3 reports command result and latest device state upstream.
10. Dashboard updates desired state, reported state, and command timeline.

### Architecture Layers

- Frontend: Next.js App Router dashboard with server-side auth checks and client-side realtime updates
- Backend: Supabase Postgres plus Edge Functions
- Device access layer: versioned HTTPS device endpoints during MVP
- Device bridge: ESP32S3
- Real-time control MCU: STM32H743

### Why Web-First

Web-first keeps delivery simple and supports Vercel, Browser verification, Sentry, and rapid iteration. It also avoids splitting early effort across web and native mobile shells before the control loop is stable.

## Hardware Responsibility Split

### STM32H743

- GPIO and actuator control
- PWM generation
- Sensor acquisition
- safety interlocks
- local fallback behavior
- deterministic timing-sensitive logic

### ESP32S3

- BLE provisioning
- WiFi configuration and reconnection
- cloud request handling
- command polling or subscription
- UART bridge to STM32
- heartbeat and connectivity status
- OTA for connectivity firmware

### STM32 To ESP32 Link

Use UART first. It is simple, debuggable, and adequate for MVP command and telemetry throughput.

Each frame should contain:
- protocol version
- message type
- command or telemetry type
- correlation id
- payload length
- payload
- checksum or CRC

## Backend Model

### Core Entities

- `profiles`
- `homes`
- `home_members`
- `rooms`
- `devices`
- `device_modules`
- `device_state`
- `device_commands`
- `telemetry_events`
- `provisioning_sessions`
- `firmware_versions`
- `audit_logs`

### State Model

Keep `desired_state` and `reported_state` separate. A user command changes desired state first. Reported state changes only after hardware acknowledgement or telemetry confirmation.

### Security Model

- Supabase Auth for identity
- RLS on all user-facing tables
- installer and admin actions routed through Edge Functions
- device ingest endpoints protected by signed device credentials

## Frontend Structure

### MVP Routes

- `/signin`
- `/homes`
- `/homes/[homeId]`
- `/devices/[deviceId]`
- `/provision`
- `/settings`

### MVP Screens

- Sign-in page
- Home overview with room and device cards
- Device detail page with control panel, command history, and recent telemetry
- Provisioning flow for installer or admin
- Basic settings page for user profile and home membership

## API And Device Contract Strategy

The canonical contract should be defined before UI or backend implementation completes. It will live as a shared contract package in the repo and a protocol document under `docs/protocols/`.

Key contract surfaces:
- app-to-backend command payload
- backend-to-device normalized command
- device acknowledgement payload
- telemetry event payload
- error and timeout payload

## Testing Strategy

TDD should drive every implementation slice.

### Contract Tests

- parse and validate commands
- reject malformed payloads
- preserve correlation ids
- map desired state to UART frame payloads

### Backend Tests

- auth and membership enforcement
- command lifecycle transitions
- timeout handling
- telemetry ingest validation

### Frontend Tests

- dashboard renders assigned homes and devices
- command button transitions pending to acknowledged
- offline device state shows clear error feedback

### End-To-End Tests

- sign in
- open device
- send command
- simulate ack
- verify UI state updates

## Delivery Tooling Plan

### Immediate

- `connected-product-delivery` skill for repeatable workflow
- `Superpowers` for spec, planning, and TDD discipline
- `Supabase` for schema and backend
- `Build Web Apps` for web UI delivery

### After Core Flow Works

- `Figma` for structured design system and screen mapping
- `Linear` for task prioritization and milestone tracking
- `Vercel` for primary deployment
- `Sentry` for application monitoring
- `GitHub` for review and release hygiene
- Browser plugin for final visual and interaction QA

### Later Phase

- `Canva` for static visuals
- `Remotion` or `HyperFrames` for promo video after the product story is demonstrable
- `Netlify` only if a second hosting target is still needed

## Phase Breakdown

### Phase 1

- repo bootstrap
- shared contract package
- Supabase schema
- command API
- hardware simulator
- web dashboard

### Phase 2

- real ESP32S3 integration
- STM32H743 ack loop
- provisioning UX hardening
- deploy and monitor

### Phase 3

- structured design polish
- backlog formalization
- launch assets
- promo video

## Main Risks

- protocol churn between UI, backend, and firmware if the contract is not frozen early
- trying to build automation, analytics, and multi-platform apps too soon
- unclear ownership split between STM32 and ESP32 firmware
- missing distinction between desired state and reported state
- overcomplicating MVP with MQTT before it is needed

## Recommended First Milestone

Build one room with one controllable device type, one command family, one telemetry path, one provisioning stub, and one end-to-end tested dashboard flow. Everything else should be staged behind that proof point.
