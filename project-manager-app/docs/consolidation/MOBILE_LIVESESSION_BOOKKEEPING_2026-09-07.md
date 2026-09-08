---
title: "Bookkeeping addendum — LiveSession"
date: "2026-09-07"
status: "APPROVED_SPEC_MOVED_TO_PR_599"
---

# T-022

The LiveSession SDD set (`live-sessions.spec.md` / `.plan.md` / `.tasks.md`)
was first committed on this branch (`e5688fca`, `3ff68608`), then **moved to
its own PR #599** (`docs/prometeo-live-sessions-sdd`, from `origin/main`) — it
is a new feature, not part of this consolidation. Removed from this branch in
a later commit; `SPEC_INDEX` regenerated. History keeps the original commits
for provenance.

Current status (see PR #599):

- Spec is **`APPROVED`** — the owner signed off 2026-09-07 with 4 decisions:
  explicit `LiveSessionParticipant` table; first cut covers `inspection` +
  `assist`; no-access to resource/session → **404** (no info leak);
  `LIVEKIT_*` in Railway is a human action that blocks only the media phase.
- `plan.md` + `tasks.md` (T-001..T-067) written; implementation goes on
  `feat/prometeo-live-sessions` from `origin/main`, not here.
- Reference implementation in the non-git `project-manager-app-main` tree is
  audited in spec §13 (8 close-out gaps); nothing imported.
- Expo boundary: LiveKit/native needs an Expo development build; not forced
  into Expo Go.

`docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md` stays on this branch —
it records why T-022 is gated for the consolidation and points at PR #599 for
the contract.
