# Progress

## Session Log
- Created `task_plan.md` with goals, phases, acceptance criteria, and safety constraints.
- Created `findings.md` with initial product, architecture, safety, and MVP findings.
- Created `progress.md` for ongoing work notes.
- Launched parallel architecture workflow `wf_2d3eeeac-5af` to validate architecture, scoring, adapters, safety, and MVP scope.
- Scaffolded npm workspace root and `@job-assistant/shared` package.
- Implemented shared types, text helpers, resume text parsing, deterministic scoring, queue policy, audit log helpers, Boss adapter, and platform stubs.
- Added shared tests for scoring, queue behavior, and Boss adapter extraction.
- Created `@job-assistant/extension` package with Vite React build configuration.
- Added MV3 manifest, background service worker, content script, storage adapter, runtime message types, popup, side panel UI, and CSS.
- Installed npm dependencies and generated `package-lock.json`.
- Fixed shared adapter typing and made adapter tests dependency-free.
- Expanded deterministic scoring to cover company grade, job grade, compensation, bonuses, benefits, rest pattern, and annual leave.
- Updated queue execution so dry-run apply recommendations can run safely, while manual approval still pauses.
- Enforced daily caps and minimum interval across queue attempts.
- Added side panel ranking details and a per-job full-web research search link for salary/bonus/benefit/rest/leave evidence.
- Added extension initial-state smoke test.
- Built the MV3 extension into `apps/extension/dist`.
- Upgraded Vite/Vitest/@vitejs/plugin-react to current fixed versions and regenerated `package-lock.json`.
- Confirmed `npm audit --audit-level=moderate` reports zero vulnerabilities.
- Added local company/job research records for pasted full-web evidence.
- Research records parse salary, bonus, benefits, rest pattern, annual leave, warnings, confidence, and source metadata.
- Saved research now re-scores existing queued jobs and can move pending items back into ranked dry-run order.
- Added side panel controls to save research evidence and see recent evidence summaries.
- Added shared research tests.
- Added research query generation and active-page research capture via user-triggered `activeTab` + `scripting`.
- Side panel can now open a search for a company/job and capture the active source page into a research record.
- Added a queue application runner: dry-run records locally, manual approval opens the job page and highlights the apply/contact button, and auto mode performs one guarded click after safety/rate-limit checks.
- Content script now detects captcha/login/platform warning/required-field states before preparing an application action.
- Auto mode now inspects the page after the click and only completes a queue item when a success signal is visible; confirmation dialogs, resume selection, required follow-up, or ambiguous outcomes pause for manual review.
- Research scoring now aggregates all matching saved web sources for a company/job, merging salary, bonus, benefits, rest schedule, annual leave, and warnings before rescoring queue order.
- Added an explicit scheduled automation runner: when policy mode is `auto`, the side panel can start/stop a Chrome alarms-backed queue worker that runs one eligible top-ranked item per safe interval and stops on pauses or non-auto mode.
- Added explicit company-first ranking: queued jobs are grouped by company rank first, jobs are ranked inside each company second, and the side panel now displays those ranks.
- Improved resume intent parsing: target roles, target cities, industries, skills, and years of experience can now be inferred from labeled resume text, and the side panel no longer seeds every resume with default target roles.
- Queue reconciliation now re-scores and fills the queue when resume profiles, blacklist rules, or research evidence changes, so jobs scanned before profile setup are ranked without needing another page scan.
- Enabled conservative DOM extraction adapters for Lagou, Liepin, and LinkedIn so those pages can produce normalized job cards for the same scoring and queue flow.

## Current Phase
Phase 4/5/6/7: Extension shell, Boss adapter, automation safety, tests, and build verification are usable for MVP dry-run. Documentation and deeper platform/application flows remain in progress.

## Next Actions
1. Add deeper background/message behavior tests for scan, research saving, rescoring, queue execution, and scheduled automation stop conditions.
2. Add browser-side PDF/Word text extraction or a local parser service.
3. Improve conflict handling and trust calibration when company research sources disagree.
4. Expand post-click handling to platform-specific confirmation dialogs and resume/profile completion flows.
5. Add live-page regression checks and platform-specific application action handlers for Boss, Lagou, Liepin, and LinkedIn.

## Test Results
| Test | Expected | Actual | Status |
|---|---|---|---|
| `npm test` | Shared and extension tests pass | 32 tests passed across both workspaces | passed |
| `npm run typecheck` | Root workspace typechecks | Shared and extension TypeScript passed | passed |
| `npm run build` | Vite emits loadable MV3 extension in `apps/extension/dist` | Manifest, popup, sidepanel, service worker, content script emitted | passed |
| `npm audit --audit-level=moderate` | No known moderate-or-higher vulnerabilities | 0 vulnerabilities | passed |

## Error Log
| Error | Attempt | Resolution |
|---|---|---|
| PowerShell classifier temporarily unavailable | 1 | Switched directory creation to Bash and used file tools for edits. |
| Invalid empty `pages` parameter on Read | 1 | Avoid passing `pages` except for PDFs. |
| `npm install` timed out after 120s | 1 | Install had completed enough to create `node_modules` and `package-lock.json`; proceeded with tests/build. |
| Shared adapter test failed with `document is not defined` | 1 | Replaced browser DOM dependency with a small fake document in the adapter unit test. |
| Extension test command failed because no tests existed | 1 | Added `apps/extension/src/storage/state.test.ts`. |
| npm audit found Vite/Vitest advisories | 1 | Upgraded dev tooling to Vite 8.0.16, Vitest 4.1.8, and @vitejs/plugin-react 6.0.2; audit now passes. |
