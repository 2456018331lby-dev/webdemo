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

Use this directory as the source of truth for the backend persistence lane. Do not describe Supabase as "done" until migrations are actually applied and verified.
