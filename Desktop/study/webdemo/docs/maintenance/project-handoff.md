# Smart Home System Handoff

Last updated: `2026-05-15`

## Operator execution preference

This project should be handed off to future agents in a way that preserves long-running autonomous execution, not chatty stop-start behavior.

- After reading the canonical source documents, form a concrete tranche and execute it continuously.
- Do not stall in repeated one- or two-sentence progress messages that do not correspond to real tool progress.
- If the user says `continue`, `继续`, or `继续完善`, resume actual execution immediately from the highest-priority unfinished task instead of restating intent.
- Keep user-facing progress updates short and factual, but prefer real work over status narration.
- Only stop to ask the user when the next step is destructive, irreversible, or materially ambiguous.
- Before handoff, write critical state into maintenance docs and project memory rather than leaving it only in chat.

## Project goal

Build a web-first smart home management system that can issue commands from a dashboard to connected hardware and reflect acknowledged device state back into the UI.

Target hardware and stack:

- `STM32H743`: deterministic control, actuator logic, safety logic, sensor sampling
- `ESP32S3`: WiFi, BLE, cloud bridge, OTA, UART bridge to STM32
- `Next.js App Router`: web dashboard
- `Supabase`: planned auth, database, realtime, Edge Functions

## Delivery objective for future agents

Do not treat this repository as “just a frontend demo”. The intended product slice is:

- web-first smart home control
- clear command lifecycle from dashboard to device bridge
- distinct desired state vs reported state
- backend persistence path via Supabase
- gradual expansion toward deployment, monitoring, design handoff, and plugin-driven delivery

The reusable skill requirement was already completed before this tranche and must remain intact.

## Canonical source documents

Read these first before changing behavior:

- `AGENTS.md`
- `docs/maintenance/project-handoff.md`
- `docs/maintenance/task-board.md`
- `docs/maintenance/progress-log.md`
- `docs/maintenance/next-agent-prompt.md`
- `docs/superpowers/specs/2026-05-10-smart-home-system-design.md`
- `docs/superpowers/plans/2026-05-10-smart-home-system-mvp.md`
- `docs/protocols/smart-home-mvp-device-contract.md`

## Plugin usage policy

This repository should not force plugin-heavy workflows on every task.

- Use plugin workflows only when plugin relevance is high.
- The existing global skill `plugin-routing-playbook` already covers this routing rule and should be reused instead of creating a duplicate plugin-routing skill.
- Trigger plugin routing only when at least one of these is true:
  - the user explicitly names a plugin
  - the task is strongly plugin-native and generic coding tools are clearly worse
  - a stable, reproducible plugin choice matters for the deliverable
- Do not add plugin-routing policy to this repo's `AGENTS.md`. Keep `AGENTS.md` lightweight and store this guidance in maintenance docs instead.
- Browser deserves extra caution in this environment:
  - use Browser when the task is truly browser-centric and the runtime is healthy
  - if Browser runtime is unavailable or unstable, use Playwright fallback and record the exact reason in maintenance docs

## Current tranche summary

This tranche moved the repo from “local MVP only” to “local MVP plus persistence-ready backend skeleton”.

### Specifically completed in this tranche

- removed repository leftover `apps/write-test.txt`
- added missing route coverage for unknown devices
- added offline-device command rejection coverage
- added command-history status rendering coverage
- implemented server-side rejection for offline device commands with `409 Device is offline`
- extracted command history rendering into a dedicated component with distinct visual status tones for:
  - `queued`
  - `delivered`
  - `acknowledged`
  - `failed`
  - `timed_out`
- abstracted the runtime behind a replaceable backend interface
- preserved the existing in-memory MVP path via a dedicated in-memory backend implementation
- added `supabase/` directory with:
  - `config.toml`
  - migration skeletons
  - verification SQL
  - Edge Function stub
  - README describing what is real vs still pending
- added Next.js-side Supabase skeleton files for SSR and browser clients
- added `.env.example` with Supabase env expectations
- updated `apps/web/package.json` to declare Supabase client dependencies
- added a backend selection factory so the server path can switch between:
  - in-memory backend by default
  - Supabase-backed backend skeleton when explicitly requested and env is configured
- added a `SupabaseDeviceBackend` placeholder class behind the shared backend interface
- started the persistence lane by wiring Supabase snapshot reads into the backend skeleton and adding tests around read caching and lifecycle state shaping
- restored the project toward the original smart-home web-control goal after a user correction; ignore later game-related drift and keep following the original single-chip / web-control objective

### Not completed in this tranche

- real Browser plugin localhost QA evidence
- actual linked Supabase project
- migration execution against local or remote Supabase
- real Supabase-backed device reads or writes
- realtime wiring
- auth flow wiring
- deployment preparation
- monitoring wiring

## Current repository state

### Working application behavior

The local MVP still functions as a non-persistent demo shell:

- homes page lists mock homes, rooms, and devices
- device detail page loads seeded state
- relay button posts a command to the API route
- API validates payload shape through the shared contract
- runtime queues the command, simulates delivery, simulates ack, and updates reported state
- UI refreshes relay state and command history after the POST
- offline devices are now rejected at the API layer instead of being silently accepted

### Current app routes

- `/`
- `/homes`
- `/devices/[deviceId]`
- `/api/devices/[deviceId]/commands`

### Important architecture decisions already made

- web-first MVP, not native-app first
- UART is the first `ESP32S3 <-> STM32H743` bridge
- desired state and reported state stay separate
- contract-first message shape between app, backend, and firmware
- simulator path exists before real hardware coupling
- persistence path should be added behind replaceable server interfaces, not by hard-wiring Supabase directly into current demo logic

## Implementation inventory

### Existing core app and contract

- `apps/web`
- `packages/device-contract`

### New or materially changed files in this tranche

- `apps/web/src/app/api/devices/[deviceId]/commands/route.ts`
- `apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts`
- `apps/web/src/components/command-history-list.tsx`
- `apps/web/src/components/command-history-list.test.tsx`
- `apps/web/src/components/device-command-client.tsx`
- `apps/web/src/components/device-control-panel.test.tsx`
- `apps/web/src/lib/server/device-backend.ts`
- `apps/web/src/lib/server/device-backend-factory.ts`
- `apps/web/src/lib/server/device-backend-factory.test.ts`
- `apps/web/src/lib/server/in-memory-device-backend.ts`
- `apps/web/src/lib/server/supabase-device-backend.ts`
- `apps/web/src/lib/server/device-runtime.ts`
- `apps/web/src/lib/server/device-repository.ts`
- `apps/web/src/lib/supabase/env.ts`
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/supabase/types.ts`
- `supabase/config.toml`
- `supabase/README.md`
- `supabase/migrations/20260510180000_initial_schema.sql`
- `supabase/migrations/20260510181000_rls_policies.sql`
- `supabase/migrations/20260510182000_command_views.sql`
- `supabase/verification/verify_mvp.sql`
- `supabase/functions/device-ingest/index.ts`
- `.env.example`

### Deleted in this tranche

- `apps/write-test.txt`

## Verification status

### Fresh verification completed in this tranche

- `npm run test -- --run apps/web/src/lib/server/supabase-device-backend.test.ts apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts apps/web/src/lib/server/device-backend-factory.test.ts`
  - result: pass
  - caveat: validates the targeted Supabase backend skeleton, device command route, and backend factory only
- `npm run lint`
  - result: pass
  - caveat: does not prove runtime behavior
- `npm run build`
  - result: pass
  - caveat: proves production build success only

### Additional targeted verification run during development

- `node .\\node_modules\\vitest\\vitest.mjs run 'apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts'`
  - result: pass after offline rejection implementation
- `node .\\node_modules\\vitest\\vitest.mjs run 'apps/web/src/components/command-history-list.test.tsx'`
  - result: pass after command-history component extraction
- `node .\\node_modules\\vitest\\vitest.mjs run 'apps/web/src/lib/server/device-backend-factory.test.ts'`
  - result: pass after backend selection factory implementation

### Verification still missing

- Browser plugin local QA evidence on `/homes`
- Browser plugin local QA evidence on `/devices/device-relay-01`
- Supabase schema verification against an actual database instance

### Browser-level fallback evidence captured

Playwright fallback evidence is now captured and stored under `output/playwright/`.

Observed results:

- `/homes`
  - heading rendered
  - sample device CTA rendered
  - online status labels rendered
- `/devices/device-relay-01`
  - device page rendered correctly
  - relay command interaction succeeded
  - acknowledged state appeared after click
  - relay control flipped from `Turn relay off` to `Turn relay on`
- console output only showed React DevTools informational messages, not app errors

### Browser caveat

- Browser has shown session/runtime instability in this environment.
- Future agents should not keep retrying Browser indefinitely.
- If the task specifically needs Browser and the runtime is healthy, use it.
- If the task only needs browser-level proof and Browser runtime is missing or unstable, use Playwright and document the fallback reason.

## Plugin execution status

Be strict: only count actual use or concrete output, not compatibility.

### Actually used or materially advanced

- `Superpowers`
  - used as execution discipline for TDD and verification-first work
- `Build Web Apps`
  - frontend verification workflow was explicitly consulted
- `Supabase`
  - advanced from architecture-only planning to actual repo structure, schema skeleton files, and a selectable backend integration path
- `plugin-routing-playbook`
  - identified as the correct existing routing gate so plugin usage can stay selective instead of being treated as always-on repo policy

### Prepared but not yet truly completed

- `Browser`
  - browser plugin remains not completed in this repo because localhost QA used Playwright fallback instead of Browser runtime
- `Vercel`
  - stack remains compatible, but no project linkage or deploy config has been completed
- `Netlify`
  - still unused
- `Sentry`
  - still unwired

### Still pending and must not be overstated

- `Figma`
- `Linear`
- `GitHub` publish workflow
- `Canva`
- `Remotion`
- `HyperFrames`

## Current gaps

### High priority

- no real Browser-plugin QA evidence captured yet; only Playwright fallback evidence exists
- no live Supabase project bound to the repo
- no executed migration run against local or hosted Supabase
- no real Supabase-backed command or state persistence yet
- no actual auth enforcement in the app
- no real ESP32S3 or STM32H743 integration

### Medium priority

- no deployment config yet
- no monitoring config yet
- no realtime event path yet
- no device ingest persistence implementation yet

### Lower priority for MVP core flow

- design export
- task sync to external systems
- marketing assets
- promo video

## Risks and caveats

- runtime state is still in-memory only; restart clears command history and device state
- Supabase files and backend selection path exist, but the Supabase backend implementation itself is still a placeholder and is not yet verified against a database
- `supabase` CLI was not available on PATH in this session
- `npx supabase --version` and `npx supabase --help` timed out in this environment, so migration generation could not be CLI-verified here
- API route is still unauthenticated
- current frontend behavior is still driven by mock data plus local runtime state
- Browser plugin has known instability in this environment; Playwright is the safer validation fallback until Browser runtime is confirmed healthy

## Recommended next execution order

1. Use the existing `plugin-routing-playbook` only if plugin routing is actually needed for the next task. Do not expand into plugin workflows by default.
2. Decide whether Browser-plugin evidence is still required for this project milestone, or whether Playwright fallback evidence is sufficient for now.
3. If Browser-specific evidence is still required, attempt it once when the runtime is healthy and record the result without looping on failures.
4. Decide whether to install or repair Supabase CLI locally, or connect to a real Supabase project.
5. Apply or validate the SQL skeleton against an actual Supabase database.
6. Replace the placeholder `SupabaseDeviceBackend` with real read paths first, then command writes.
7. After backend path is grounded, move to deployment and monitoring preparation.

## First action for the next agent

Open `docs/maintenance/task-board.md`, take the highest-priority unfinished item, complete it, and update all maintenance docs before handoff.
