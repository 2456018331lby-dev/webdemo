# Supabase Workspace

This directory holds the persistent backend skeleton for the smart home MVP.

What is concretely completed here:

- schema and policy SQL skeletons
- verification SQL checks
- an Edge Function stub for device ingest
- Next.js SSR client wiring points in `apps/web/src/lib/supabase`

What is not completed yet:

- linked Supabase project
- applied migrations against a live or local database
- auth flow wiring
- realtime subscriptions
- device bridge credentials

## Activation checklist

Use the CLI through `npx` on this machine; there is no global `supabase` binary.

1. Set `SMART_HOME_BACKEND=supabase` in your local env.
2. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Authenticate: `npx supabase login`
4. Link the project: `npx supabase link --project-ref <project-ref> -p <db-password>`
5. Push migrations: `npx supabase db push --linked --include-all`
6. Verify remote history: `npx supabase migration list --linked`

## Current blocker (2026-06-01)

- `npx supabase --version` works and reports `2.102.0`
- `npx supabase projects list --output json` currently fails with:
  `Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.`
- No `.mcp.json` is present in the repo, so Supabase MCP has not been wired for this workspace either.

Use this directory as the source of truth for the backend persistence lane. Do not describe Supabase as "done" until migrations are actually applied and verified.
