# Maintenance Docs

This directory is the handoff surface for future AI or human maintainers.

## Files

- `project-handoff.md`
  Current objective, architecture, implementation status, verification evidence, tool or plugin status, risks, and handoff guidance.
- `progress-log.md`
  Append-only dated progress history.
- `task-board.md`
  Prioritized execution list with status and next actions.

## Update protocol

Whenever code, docs, tests, deployment prep, or integration state changes:

1. Update `project-handoff.md`
2. Append a short dated entry to `progress-log.md`
3. Adjust statuses in `task-board.md`

## Handoff standard

A handoff is incomplete if it does not include:

- current repo state
- latest verification evidence
- remaining gaps
- explicit next recommended action
- honest plugin or environment limitations
