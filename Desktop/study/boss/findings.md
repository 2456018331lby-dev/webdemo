# Findings

## Project State
- `C:\Users\24560\Desktop\study\boss` began as an empty project directory.
- The surrounding git repository root is higher than this directory and includes many unrelated modified/untracked files. Work should stay scoped to this project directory.
- Current project now contains an npm workspace with `packages/shared` and `apps/extension`.

## Product Requirements Captured
- Chrome Manifest V3 extension for job search/application assistance.
- Platforms: Boss Zhipin, Lagou, Liepin, LinkedIn.
- Resume upload/parsing: PDF and Word support, with text paste fallback.
- Scoring: company and job score ranking with explainable reasons.
- Automation: batch apply with rate limits, blacklist, logs, manual fallback, and safe pause conditions.

## Safety and Compliance Notes
- Do not bypass captcha, login restrictions, anti-bot systems, or platform protections.
- Do not implement stealth, detection evasion, mass targeting, or spam behavior.
- MVP defaults to dry-run/manual confirmation.
- Automation should pause on captcha, login prompts, unknown DOM, missing required fields, or platform warnings.
- Real page-click application automation is deliberately not implemented yet; dry-run records and queue behavior come first.

## Architecture Findings
- MV3 service workers are ephemeral; persistent queue state lives in `chrome.storage.local` and is rehydrated on demand.
- Content scripts are platform-specific adapters that extract normalized job data and perform only limited user-authorized actions.
- Side panel UI is the main control center: resume profile, scoring settings, blacklist, queue, and logs.
- Shared package owns deterministic logic so extension UI, content scripts, and tests use the same behavior.

## MVP Boundaries
- Boss adapter is the first functional adapter.
- Lagou/Liepin/LinkedIn begin as adapter stubs with normalized extraction contracts.
- Resume parsing supports text paste immediately and exposes parser interface for PDF/Word extraction later.
- Backend/API is deferred; local-first extension keeps the initial version easier to test and safer for private data.

## Files Created
- Root: `package.json`, `tsconfig.base.json`, `.gitignore`.
- Shared: `packages/shared/src/{types,text,resume,scoring,queue,audit,adapters,index}.ts` and tests.
- Extension: `apps/extension/package.json`, `vite.config.ts`, `tsconfig.json`, `public/manifest.json`, popup/sidepanel HTML, background/content/storage/ui source files.
