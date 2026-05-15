# Smart Home System MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-first smart home management MVP that can authenticate users, register homes and devices, issue commands to connected hardware, and display acknowledged state and recent telemetry.

**Architecture:** Use a Next.js App Router dashboard as the primary control surface, Supabase as the auth and data backbone, and a split device architecture where ESP32S3 handles connectivity and STM32H743 handles deterministic control. Start with an HTTPS-based device bridge and a simulator so the UI and backend can be validated before final hardware coupling.

**Tech Stack:** Next.js, TypeScript, Supabase, Postgres, Edge Functions, React Testing Library, Vitest, Playwright, npm workspaces, Sentry, Vercel

---

## Proposed Repository Layout

```text
apps/
  web/
packages/
  device-contract/
  ui/
supabase/
  migrations/
  functions/
docs/
  briefs/
  protocols/
  superpowers/
tests/
  e2e/
```

### Task 1: Bootstrap The Workspace And Test Harness

**Files:**
- Create: `package.json`
- Create: `apps/web/`
- Create: `packages/device-contract/`
- Create: `tests/e2e/`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Scaffold the web app and workspace**

Run:

```bash
npx create-next-app@latest apps/web --ts --eslint --app --src-dir --use-npm --import-alias "@/*"
```

Expected: a working `apps/web` Next.js app with TypeScript and App Router.

- [ ] **Step 2: Add workspace root config**

Create a root `package.json` similar to:

```json
{
  "name": "smart-home-system",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace web",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "npm run lint --workspace web"
  }
}
```

- [ ] **Step 3: Add baseline test tooling**

Install dev dependencies:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: root test commands install without peer dependency errors.

- [ ] **Step 4: Verify the scaffold works**

Run:

```bash
npm run lint
```

Expected: lint succeeds on the generated web app.

### Task 2: Lock The Device Contract First

**Files:**
- Create: `packages/device-contract/package.json`
- Create: `packages/device-contract/src/index.ts`
- Create: `packages/device-contract/src/contract.test.ts`
- Modify: `docs/protocols/smart-home-mvp-device-contract.md`

- [ ] **Step 1: Write the failing contract tests**

Create tests like:

```ts
import { describe, expect, it } from "vitest";
import { parseCommandRequest, parseTelemetryEvent } from "./index";

describe("device contract", () => {
  it("accepts a valid relay command", () => {
    const result = parseCommandRequest({
      deviceId: "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
      commandType: "relay.set",
      correlationId: "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
      payload: { channel: 1, value: true }
    });

    expect(result.commandType).toBe("relay.set");
  });

  it("rejects malformed telemetry payloads", () => {
    expect(() =>
      parseTelemetryEvent({
        messageType: "telemetry",
        metrics: { temperatureC: "bad" }
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```bash
npx vitest run packages/device-contract/src/contract.test.ts
```

Expected: fail because parser functions do not exist yet.

- [ ] **Step 3: Implement the minimal contract package**

Implement parsers and schemas in `packages/device-contract/src/index.ts` using runtime validation.

Core exports should include:
- `parseCommandRequest`
- `parseTelemetryEvent`
- `parseAckPayload`
- `CommandLifecycleState`

- [ ] **Step 4: Re-run the tests and confirm GREEN**

Run:

```bash
npx vitest run packages/device-contract/src/contract.test.ts
```

Expected: all contract tests pass.

### Task 3: Build Supabase Schema And RLS

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `supabase/migrations/0003_command_views.sql`
- Test: `supabase/verification/verify_mvp.sql`

- [ ] **Step 1: Write the schema verification queries first**

Create SQL checks that verify:
- required tables exist
- `device_commands` includes lifecycle columns
- `device_state` separates desired and reported state
- RLS is enabled on user-facing tables

- [ ] **Step 2: Run the verification query and confirm RED**

Run with your chosen local Supabase or Postgres verification path.

Expected: checks fail because the schema does not exist yet.

- [ ] **Step 3: Write the initial schema migration**

Include tables for:
- `profiles`
- `homes`
- `home_members`
- `rooms`
- `devices`
- `device_state`
- `device_commands`
- `telemetry_events`
- `provisioning_sessions`
- `audit_logs`

- [ ] **Step 4: Add RLS policies**

Policies must ensure:
- home owners and members only see their own homes and devices
- only installer or admin roles can create provisioning sessions
- command writes require authenticated membership

- [ ] **Step 5: Re-run schema verification**

Expected: verification queries pass and no required tables are missing.

### Task 4: Implement The Command API And Device Ingest Path

**Files:**
- Create: `apps/web/src/app/api/devices/[deviceId]/commands/route.ts`
- Create: `supabase/functions/device-ingest/index.ts`
- Create: `apps/web/src/lib/server/device-commands.ts`
- Test: `apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts`

- [ ] **Step 1: Write the failing API test**

Create a route test that asserts:
- unauthenticated requests fail
- valid relay commands create a `queued` command row
- malformed payloads return `400`

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts
```

Expected: fail because the route and server helpers do not exist yet.

- [ ] **Step 3: Implement the minimal route and server command writer**

Implementation must:
- validate payloads through `packages/device-contract`
- verify user membership against the device home
- write a command row with correlation id and `queued` state

- [ ] **Step 4: Add device ingest handling**

The first version of `supabase/functions/device-ingest/index.ts` should:
- authenticate the device bridge
- accept `ack`, `telemetry`, and `error` payloads
- update `device_commands` and `device_state`
- insert `telemetry_events`

- [ ] **Step 5: Re-run API tests**

Expected: route tests pass and invalid payload handling is covered.

### Task 5: Add A Simulator Before Real Hardware Coupling

**Files:**
- Create: `apps/web/src/lib/server/device-simulator.ts`
- Create: `apps/web/src/lib/server/device-simulator.test.ts`
- Modify: `apps/web/src/lib/server/device-commands.ts`

- [ ] **Step 1: Write the failing simulator test**

Test that a queued command can be advanced to:
- `delivered`
- `acknowledged`

and that `reported_state` reflects the acknowledged payload.

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run apps/web/src/lib/server/device-simulator.test.ts
```

Expected: fail because the simulator does not exist yet.

- [ ] **Step 3: Implement the simulator**

The simulator should:
- read queued commands
- generate synthetic ack payloads
- update device state
- create a small telemetry event

- [ ] **Step 4: Re-run the test and confirm GREEN**

Expected: simulator tests pass and allow frontend progress before MCU integration.

### Task 6: Build The Dashboard UI

**Files:**
- Create: `apps/web/src/app/(dashboard)/homes/page.tsx`
- Create: `apps/web/src/app/(dashboard)/devices/[deviceId]/page.tsx`
- Create: `apps/web/src/components/device-control-panel.tsx`
- Create: `apps/web/src/components/command-history.tsx`
- Test: `apps/web/src/components/device-control-panel.test.tsx`

- [ ] **Step 1: Write the failing control panel test**

Test that:
- clicking a relay toggle shows a pending state
- an acknowledged result replaces pending with the new reported state
- an offline device shows a disabled control state

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run apps/web/src/components/device-control-panel.test.tsx
```

Expected: fail because the component does not exist yet.

- [ ] **Step 3: Implement the dashboard screens**

Implement:
- homes overview
- device detail layout
- control panel with pending, acknowledged, failed, and offline states
- recent telemetry list
- command history list

- [ ] **Step 4: Re-run the component tests**

Expected: component tests pass and pending-versus-reported state handling is explicit.

### Task 7: Verify The Full Browser Story

**Files:**
- Create: `tests/e2e/device-command.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write the failing end-to-end spec**

The browser story should:
1. sign in
2. open a seeded device
3. send a relay command
4. trigger simulator ack
5. verify the UI shows acknowledged state

- [ ] **Step 2: Run the end-to-end test and confirm RED**

Run:

```bash
npx playwright test tests/e2e/device-command.spec.ts
```

Expected: fail until the seeded app flow exists.

- [ ] **Step 3: Complete the missing integration glue**

Add any missing seeding, session, or simulator hooks needed only to make the verified story work end to end.

- [ ] **Step 4: Re-run the browser test and confirm GREEN**

Expected: the full story passes without manual database edits.

### Task 8: Deploy, Observe, And Prepare Release

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `docs/plans/release-checklist.md`
- Modify: project deployment config files as needed

- [ ] **Step 1: Add a failing smoke verification target**

Define a manual or automated smoke checklist that proves:
- sign in works
- home list loads
- command dispatch works
- simulator ack updates the UI

- [ ] **Step 2: Configure Sentry**

Add error capture for:
- route failures
- unexpected dashboard render failures
- command submission failures

- [ ] **Step 3: Deploy to the primary host**

Default target:

```bash
vercel
```

Secondary Netlify deployment should wait until the primary deployment is stable.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm run lint
npm run test
npm run test:e2e
```

Expected: all three commands succeed before release.

## Plan Notes

- The first working milestone uses a simulator instead of direct STM32 or ESP32 coupling so the product loop can be verified earlier.
- The protocol document is a source-of-truth artifact. Update tests before updating implementation.
- Do not add MQTT during MVP unless measured system behavior proves HTTPS polling or push is insufficient.
