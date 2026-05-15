# Task Board

Last updated: `2026-05-15`

## In progress

- [ ] 继续推进单片机网页控制主目标：实现 Supabase 持久化命令写入与设备状态读写闭环

## Highest priority next

- [x] Remove repository leftovers like `apps/write-test.txt`
- [x] Create `supabase/` structure with schema and migration skeleton for homes, rooms, devices, state, commands, telemetry, provisioning, and audit logs
- [x] Add a persistence-ready server abstraction so the current in-memory runtime is not the only backend path
- [x] Add missing tests for offline command behavior, missing device behavior, and command status rendering
- [x] Rerun `npm run test`
- [x] Rerun `npm run lint`
- [x] Rerun `npm run build`
- [x] Perform browser-based QA against `/homes` and `/devices/device-relay-01`
  Completed via Playwright fallback. Browser plugin path still pending as a separate plugin-specific outcome.
- [x] Advance `Supabase` from planned architecture to actual repo structure and schema files
- [x] Keep `Superpowers` TDD and verification discipline active on new work
- [x] Use `Build Web Apps` workflow for frontend verification after UI edits
- [ ] Supabase-backed schema or verified local equivalent
- [ ] Replace placeholder `SupabaseDeviceBackend` reads with real Supabase-backed device snapshot reads
- [ ] Replace placeholder `SupabaseDeviceBackend` command writes with real persistence flow
- [x] Browser-based visual and interaction QA evidence
  Completed with Playwright fallback artifacts in `output/playwright/`.
- [ ] Vercel or Netlify deployment preparation
- [ ] Sentry monitoring setup
- [ ] Figma structured design handoff
- [ ] Linear task sync
- [ ] GitHub publish flow
- [ ] Canva or image asset generation where truly needed
- [ ] Remotion or HyperFrames promo video

## Deferred until core product is stronger

- [ ] Real ESP32S3 cloud bridge implementation
- [ ] Real STM32H743 ack path implementation
- [ ] Provisioning UX beyond stub level
- [ ] Marketing and promo deliverables

## Process note

- Plugin workflows are selective, not default-on.
- Reuse the existing global `plugin-routing-playbook` when plugin routing is actually needed.
- Do not grow repo `AGENTS.md` with plugin-routing rules.
- Future agents should default to autonomous multi-step execution tranches instead of repeated progress-only chat turns.
- When the user says `continue` or `继续完善`, resume the next real task immediately rather than rephrasing the plan.
