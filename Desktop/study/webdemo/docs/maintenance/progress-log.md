# Progress Log

## 2026-05-10

- Created and validated the reusable Codex skill `connected-product-delivery`.
- Wrote the initial product design spec, MVP implementation plan, protocol doc, and delivery briefs.
- Bootstrapped a local npm workspace with `apps/web` and `packages/device-contract`.
- Implemented the first local smart-home MVP shell with:
  - homes dashboard
  - device detail page
  - shared device contract validation
  - in-memory command lifecycle runtime
  - simulated relay ack loop
  - API route for command submission
- Added unit tests for contract parsing, runtime behavior, UI relay control behavior, and the command route.
- Verified earlier that test, lint, build, and basic local HTTP checks passed.
- Added this maintenance documentation set so future AI sessions can continue work without relying on chat history.
- Continued the smart-home MVP with a persistence-oriented tranche:
  - removed leftover file `apps/write-test.txt`
  - added route tests for missing devices and offline command rejection
  - added command-history rendering tests for lifecycle statuses
  - implemented `409 Device is offline` rejection in the command route
  - extracted command history into a dedicated component with distinct status tones
  - introduced a replaceable device backend abstraction plus in-memory backend implementation
  - added Supabase repository skeleton files under `supabase/`
  - added Next.js Supabase SSR and browser client skeleton files
- Fresh verification completed:
  - `npm run test` passed
  - `npm run lint` passed
  - `npm run build` passed
- Remaining major gap after this tranche: Browser localhost QA evidence is still not completed and must be captured in a follow-up update before calling Browser done.
- Tightened the process guidance for future agents:
  - confirmed the existing global skill `plugin-routing-playbook` should be reused for selective plugin routing
  - decided not to move plugin-routing policy into repo `AGENTS.md`
  - documented that Browser should be used only when highly relevant and runtime-healthy, with Playwright fallback recorded when needed
- Added an execution-style handoff rule for future agents:
  - default to autonomous multi-step execution after initial repo reading
  - avoid repeated short status-only replies without corresponding tool progress
  - treat `continue` / `继续` / `继续完善` as a directive to resume actual work immediately
  - persist that preference in maintenance docs and `.omx/project-memory.json`
- Completed browser-level localhost QA using Playwright fallback instead of Browser:
  - verified `/homes` renders expected dashboard content
  - verified `/devices/device-relay-01` renders and the relay command interaction reaches acknowledged UI state
  - saved QA artifacts under `output/playwright/`
  - left Browser plugin honestly marked as not completed because the Browser runtime path itself was not executed successfully in this tranche
- Added the first selectable persistence integration seam:
  - wrote tests for backend selection behavior
  - added `device-backend-factory.ts`
  - kept in-memory backend as the default path
  - added a `SupabaseDeviceBackend` placeholder behind the same backend interface so later work can replace reads and writes without breaking the current API surface
- Re-ran full verification after the backend-selection changes:
  - `npm run test` passed
  - `npm run lint` passed
  - `npm run build` passed
- Continued the original smart-home web-control objective after a user correction:
  - user clarified that the project should stay on the single-chip / smart-home web-control track
  - later game-related drift must be ignored
  - the current execution should remain anchored to the original smart-home / MCU web control goal
- Advanced the persistence lane beyond the placeholder stage:
  - wired Supabase snapshot reads into the backend skeleton
  - added caching/state-shaping tests for `SupabaseDeviceBackend`
  - added in-memory lifecycle support inside the Supabase skeleton so command-state behavior can be developed without breaking the current API surface
- Fresh verification completed after the Supabase read-path work:
  - `npm run test -- --run apps/web/src/lib/server/supabase-device-backend.test.ts apps/web/src/app/api/devices/[deviceId]/commands/route.test.ts apps/web/src/lib/server/device-backend-factory.test.ts` passed
  - `npm run lint` passed
  - `npm run build` passed
- Observed during the Supabase read-path work:
  - local npm install had to refresh optional Rollup native deps before Vitest could run
  - build/type-check required making the server snapshot access async and aligning the backend snapshot/repository shape

## Update rule

Append a new dated entry after every substantive implementation, verification, deployment, or integration change.
