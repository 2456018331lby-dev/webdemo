# Task Plan

## Goal
Build a local-first Chrome Manifest V3 job application assistant project. It should support Boss Zhipin first, with shared adapter foundations for Lagou, Liepin, and LinkedIn; PDF/Word resume upload and parsing; deterministic company/job scoring; queue-based batch application with rate limits, blacklist, audit logs, dry-run/manual approval, and safe pause conditions.

## Working Principles
- Personal, authorized browser-session automation only.
- No captcha bypass, anti-detection evasion, account abuse, spam, or destructive behavior.
- Default to dry-run/manual confirmation for applying until the user explicitly enables automation.
- Keep resume data local in MVP; make later server persistence optional.
- Use clear logs and explainable scoring so every action can be reviewed.

## Stack Decision
- Monorepo with TypeScript npm workspaces.
- Chrome MV3 extension built with Vite + React + TypeScript.
- Shared domain package for schemas, scoring, queue, rate limits, platform adapter contracts, and resume parsing helpers.
- Tests with Vitest.
- MVP storage via Chrome storage/local JSON-compatible structures; server/database deferred until the extension MVP is stable.

## Phases
| Phase | Status | Notes |
|---|---|---|
| 1. Discovery and architecture planning | complete | Initial plan/finding/progress files created. |
| 2. Project scaffolding | complete | Root npm workspace, shared package, extension package and Vite config created. |
| 3. Shared domain implementation | complete | Schemas, scoring, company-first ranking, queue, audit, resume intent parser, multi-source research evidence parser/scorer and platform adapters added. |
| 4. Extension shell | usable | Manifest, background service worker, content script, popup and side panel UI build into a loadable MV3 directory. |
| 5. Platform adapters | in_progress | Boss adapter MVP in shared package; Lagou/Liepin/LinkedIn stubs added. |
| 6. Automation safety | in_progress | Dry-run/manual/auto modes, queue policy, default blacklist, audit logs, daily cap, minimum interval, active-page research capture and safety pause checks added; auto performs one guarded page click and completes only after a visible success signal. A Chrome alarms-backed runner can be explicitly started/stopped to process one eligible ranked item per safe interval. |
| 7. Tests and verification | usable | `npm install`, `npm test`, `npm run typecheck`, `npm run build`, and `npm audit --audit-level=moderate` pass. |
| 8. Documentation and handoff | in_progress | README added; deeper handoff docs still need background/message coverage notes after more automation work. |

## Acceptance Criteria
- `npm install`, `npm test`, and `npm run build` work from the project root.
- Extension builds into a loadable Chrome unpacked extension directory.
- User can paste resume text, infer intent roles/cities/industries/skills, score jobs, view explanations, queue jobs, blacklist companies/keywords, and run dry-run applications.
- Jobs scanned before or after profile setup are reconciled into the ranked queue when resume, blacklist, or research data changes.
- User can open company/job web research searches and capture the active source page into local evidence for rescoring.
- Multiple saved research sources for the same company/job are aggregated into one ranking signal with merged positive evidence and negative warning penalties.
- Queue ordering is company-first: companies are ranked best-to-worst, then jobs inside each company are ranked best-to-worst.
- Boss pages can be scanned into normalized job cards using resilient selectors and fallback text extraction.
- Lagou/Liepin/LinkedIn adapters are wired as stubs with clear contracts and TODO boundaries.
- Automation has rate limits, daily cap, random-free deterministic scheduling policy for tests, pause on unknown/captcha/login/DOM mismatch, and audit logs.
- Manual approval mode opens a job page and highlights the detected apply/contact button instead of clicking it.
- Auto mode may click only after safety checks pass and must pause on captcha/login/platform warning/missing required fields/unknown DOM, confirmation dialogs, resume selection, or ambiguous post-click outcomes.
- Scheduled automation must be explicitly started, must stop when policy leaves auto mode, and must not bypass queue rate limits or pause conditions.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `Glob **/*` found no files in project root | 1 | Treat current project as empty and scaffold from scratch. |
| `git status` scans parent user profile because repo root is higher than project dir | 1 | Avoid broad git operations unless needed; operate inside `C:\Users\24560\Desktop\study\boss`. |
| PowerShell permission classifier temporarily unavailable | 1 | Used Bash for directory creation; continued with Write/Edit for files. |
| Accidental Read calls included invalid empty `pages` parameter | 1 | Re-ran Read without relying on PDF pages behavior; logged to avoid repeating. |

## Open Decisions Chosen Autonomously
- Start with extension-first architecture, not a full hosted SaaS.
- Use deterministic scoring and local logs before any AI/API scoring.
- Make Boss the first real adapter because user named it first and the project directory is `boss`.
- Keep bulk application safe by requiring dry-run/manual mode by default and implementing hard rate limits.
