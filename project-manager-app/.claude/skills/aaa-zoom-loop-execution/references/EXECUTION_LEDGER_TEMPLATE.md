# EXECUTION_LEDGER_TEMPLATE.md

Session scratchpad for tracking loop iterations — not a persisted artifact. If the task has a real `.spec.md`, its frontmatter (`code_status`/`ci_status`/`merge_status`/`deploy_status`/`activation_status`/`migration_status`) is the durable record; keep both in sync rather than maintaining this as a second source of truth that nobody re-reads later.

| Task ID | Task | State | Loop # | Current Gap | Last Verification | Next Action | Blocker | Evidence |
|---|---|---|---:|---|---|---|---|---|
| T-001 |  | NOT_STARTED | 0 |  |  |  |  |  |

## Allowed states

- NOT_STARTED
- INSPECTING
- IMPLEMENTING
- VERIFYING
- REOPENED
- BLOCKED
- CLOSED

## Rule

A task cannot be `CLOSED` unless its exit gate has objective evidence.
