---
name: testing-worker-tracker
description: How to exercise the worker Time Tracker (/worker/tracker) in a browser — offline/pending work seeding, the KPI-vs-aggregate distinction, and the gotchas that make tracker assertions flaky. Use when testing or debugging /worker/tracker (Timer, Resumen, Registros, Reportes) or anything reading trackerLocalStore.
---

# Testing /worker/tracker (Labor Engine UI)

## Bringing the stack up

Use the blueprint `startup` knowledge (Postgres + Redis in Docker, `pnpm dev:api` on :4132,
`pnpm dev:web` on :3001, `pnpm --filter @semse/db prisma:deploy && prisma:seed`).
Docker IS available on the Devin VM — prefer the real API over stubbing it.
`pnpm dev:web` without `PORT` binds **:3000**, so always pass `PORT=3001` if you rely on that port.

Demo login (needs `SEMSE_DEMO_MODE=true`): `worker@demo.semse` / `demo1234` → role PRO, which is the
role that can reach `/worker/*`.

## Offline / pending work lives in localStorage

Key: `semse.worker.tracker.failsafe.v1` (see `apps/web/app/(app)/worker/tracker/trackerLocalStore.ts`):

```json
{ "version": 1,
  "activeSession": { "id": "...", "backendSessionId": "...optional...", "status": "RUNNING|PAUSED|STOPPED",
                     "startedAt": "...", "accumulatedSeconds": 0, "updatedAt": "..." },
  "pendingEvents": [ { "id": "...", "type": "manual_session", "date": "YYYY-MM-DD",
                       "startTime": "08:00", "endTime": "10:00", "breakMinutes": 0,
                       "purpose": "payable", "localTimestamp": "..." } ],
  "syncStatus": "pending" }
```

Two ways to create pending work:
- Through the UI: make the manual-entry POST fail (5xx or offline) — `Registros → Entrada manual` then
  falls back to queueing locally and shows a `Pendiente de sincronizar` badge. Preferred, exercises the real path.
- By seeding the key directly (needed for a long-running timer you can't produce by waiting). Use a
  **PAUSED** session so elapsed seconds are deterministic.

**Gotcha:** writing that key *from the tracker page and reloading* gets overwritten — the page flushes its own
in-memory state on unload. Seed from another route (e.g. `/worker/dashboard`), then navigate to the tracker.

## The KPI-vs-aggregate distinction (easy to get wrong)

Two different computations consume local pending work, and they must be asserted separately:

- **KPI cards** ("Horas hoy", "Esta semana", "Este mes", Reportes "Total semana") =
  `summary.totalMinutes + pending`. The backend `getLaborSummary` counts only `status: "completed"`, so a
  running/paused timer is never in the summary and MUST come from pending → `pendingSummaryEntries`.
- **List-level aggregates** (cost, horas por propósito/proyecto, "Últimos registros", CSV) merge backend
  `entries` with pending. `listTimeEntries` does NOT filter by status, so a synced running timer already
  arrives there and must NOT also be emitted as pending → `pendingLocalEntries`.

Pending work is date-filtered to each card's / filter's own range (`pendingEntriesInRange`), so a
queued manual entry dated outside the current week/month or outside "Últimos 7/30 días" should be excluded
there but still visible under "todo".

`entrySeconds(entry)` = `durationMinutes * 60` when present, else `accumulatedSeconds` (which grows with
wall-clock time for a RUNNING local session — assert with tolerance or use PAUSED).

Fixtures with round numbers (60/120 min summaries, 1h entries) make the KPI arithmetic unambiguous.
`apps/web` has no test runner — this is browser verification only.
