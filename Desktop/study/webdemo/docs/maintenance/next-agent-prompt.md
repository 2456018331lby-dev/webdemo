# Next Agent Prompt

Use this prompt to hand the project to the next AI session.

```text
You are taking over an in-progress smart home management system project in:

C:\Users\24560\Desktop\study\webdemo

Read these files first and treat them as the current source of truth:

1. AGENTS.md
2. docs/maintenance/project-handoff.md
3. docs/maintenance/task-board.md
4. docs/maintenance/progress-log.md
5. docs/maintenance/next-agent-prompt.md
6. docs/superpowers/specs/2026-05-10-smart-home-system-design.md
7. docs/superpowers/plans/2026-05-10-smart-home-system-mvp.md
8. docs/protocols/smart-home-mvp-device-contract.md

Project objective:

- Build a web-first smart home management system that can issue commands from a Next.js dashboard to connected hardware and reflect acknowledged state back to the UI.
- Hardware direction is STM32H743 for deterministic control and ESP32S3 for WiFi/BLE/connectivity bridge.
- A reusable Codex skill was already created and should be preserved.

Critical execution rules:

- Do not stop at planning if the next implementation step is clear and low risk.
- After reading the source documents, form one concrete tranche and execute it continuously instead of repeatedly restating what you are about to do.
- Keep progress updates brief, but do not substitute progress chatter for actual tool execution.
- If the user says `continue`, `继续`, or `继续完善`, resume the highest-priority unfinished task immediately.
- Keep maintenance docs updated after every substantive change:
  - docs/maintenance/project-handoff.md
  - docs/maintenance/progress-log.md
  - docs/maintenance/task-board.md
- Do not leave critical status only in chat.
- Be explicit about which requested plugins were actually used versus only planned.
- Do not treat plugins as always-on.
- Reuse the existing global skill `plugin-routing-playbook` only when:
  - the user explicitly names a plugin
  - the task is strongly plugin-native
  - a stable reproducible plugin choice materially matters
- Do not add plugin-routing policy to repo `AGENTS.md`.

Plugin priorities the user cares about:

- Superpowers: continue using plan/TDD/verification discipline
- Build Web Apps: use for frontend workflow and QA
- Browser: use for localhost verification only when the runtime is healthy and the task is strongly browser-centric; otherwise use Playwright fallback and record the exact reason
- Supabase: must be advanced beyond planning into actual project structure and schema skeleton
- Figma, Linear, Vercel, Netlify, Sentry, GitHub, Canva, Remotion, HyperFrames: continue only when their prerequisites are met, but do not forget them

Current repo state summary:

- A local Next.js MVP shell already exists with homes page, device detail page, shared device contract, API route, and passing `test/lint/build`.
- The repo now also contains:
  - a persistence-ready backend abstraction
  - an in-memory backend implementation
  - a `supabase/` skeleton with migrations, verification SQL, config, and a device-ingest stub
  - Next.js-side Supabase env/client/server/type skeleton files
- The biggest remaining gaps are:
  - Browser localhost QA evidence
  - real Supabase project linkage and migration execution
  - persistent data path replacing in-memory runtime
  - deployment and monitoring prep
  - broader plugin deliverables not yet executed

Your next actions, in order:

1. Review docs/maintenance/task-board.md and start with the highest-priority unfinished item.
2. Keep plugin usage selective. Do not expand into plugin workflows unless the current task clearly warrants them.
3. Start with browser-level localhost QA against `/homes` and `/devices/device-relay-01`. Use Browser only if its runtime is healthy. If not, use Playwright fallback and record the exact reason Browser could not be completed.
4. Write the QA evidence back into the maintenance docs immediately after the run.
5. Only after QA evidence is captured, continue Supabase persistence work by validating or applying the SQL skeleton against an actual Supabase database.
6. Add or update tests before implementation where behavior changes.
7. Run verification commands and record results in the maintenance docs.
8. Continue autonomously until you complete a meaningful tranche of work, not just a plan.

When you finish your tranche:

- update all maintenance docs
- list what is now complete
- list what is still pending
- state exactly which plugin outcomes were truly completed
```
