---
name: testing-worker-tracker
description: How to run and exercise the SEMSE worker Time Tracker UI (/worker/tracker) locally — against the real API+Postgres or against a stub SEMSE API when Docker is unavailable — plus demo login, seeding offline/pending work into localStorage, and measuring the offline-queue auto-sync/retry behaviour.
---

# Testing the worker Time Tracker (/worker/tracker) locally

## Environment facts (verified 2026-07)

- Monorepo root is the nested dir `project-manager-app/`. `pnpm dev:web` runs
  `next dev` for `apps/web`. It binds **:3000 unless `PORT` is set** — start it as
  `env PORT=3001 pnpm dev:web` and always confirm the port in the log.
- Docker availability varies per box. **Try the real backend first** (below); only
  fall back to the stub API if Docker/Postgres are missing.

## Preferred setup: real backend (Postgres + NestJS API)

From the monorepo root, after a session restart (containers and processes do NOT
survive suspension, files do):

```bash
docker start semse-pg semse-redis   # recreate with postgres:14-alpine / redis:7-alpine if gone
DATABASE_URL="postgresql://semse:semse@127.0.0.1:5433/semse?schema=public" \
  pnpm --filter @semse/db prisma:deploy      # and prisma:seed on a fresh DB
nohup pnpm dev:api > /tmp/api.log 2>&1 &     # :4132, wait for /v1/health -> 200
nohup env PORT=3001 pnpm dev:web > /tmp/web.log 2>&1 &
```

- `apps/api/.env` must deliberately **omit `AUTH_SECRET`** in this dev flow: with it
  set, every web-BFF call 401s because the API then expects a Bearer token instead
  of the BFF identity headers.
- After `git pull`, re-run `prisma:deploy` — new migrations land often.
- No local `psql`/`redis-cli`: use `docker exec semse-pg psql -U semse -d semse -tAc "…"`.
- Demo seed identities: tenant `tenant_default`, worker `usr_worker_001`,
  jobs `job_demo_001` (in_progress) and `job_demo_004` (completed) assigned to the worker.
  **Only `job_demo_001` reliably accepts a timer start** — `job_demo_004` is offered in
  the dropdown but the API may answer `403 "This job is not assigned to you."`.
  Any bogus id (e.g. `job_does_not_exist_zzz`) is a dependable 403 generator, which is
  the easiest way to exercise non-retryable sync failures.

## Logging in without a database

`apps/web/app/api/semse/auth/token/route.ts` has demo accounts enabled whenever
`NODE_ENV !== "production"` (or `SEMSE_DEMO_MODE=true`). Log in through the real
`/login` UI with:

- worker (role PRO → `/worker/*`): `worker@demo.semse` / `demo1234`
- client: `client@demo.semse` / `demo1234`
- admin (OPS_ADMIN): `admin@demo.semse` / `demo1234`

If `SEMSE_API_BASE_URL` is set, the route tries the real API first and falls
back to these demo accounts on failure, so demo login works either way.
Session is an HMAC-signed cookie `semse_session`; in non-production the signing
secret defaults to `semse-dev-session-secret` (`apps/web/lib/auth.ts`), so a
cookie can also be minted programmatically if needed.

## Fallback: serving data without the real API (stub SEMSE API)

All web→API traffic goes through BFF routes under `app/api/semse/**`, which
proxy to `${SEMSE_API_BASE_URL}` and unwrap `{ requestId, data }`. If
`SEMSE_API_BASE_URL` is unset the BFF returns 503, and the tracker then renders
with `weekly`/`monthly` summaries = `null` — which silently zeroes several KPI
computations and makes range-bounded assertions untestable. So stub the API
instead of leaving it unconfigured.

Minimal stub (plain Node http server on :4000) must answer, all wrapped in
`{ requestId, data }`:

- `GET /v1/labor/summary/week?offset=0` → `WeeklySummaryView`
  (`period,from,to,totalMinutes,totalHours,totalEntries,byDay[],previousWeekMinutes,changePercent`)
- `GET /v1/labor/summary/month` → `MonthlySummaryView`
- `GET /v1/labor/entries?range=week|month|all` → `TimeEntryView[]`
- `GET /v1/labor/timer/active` → `TimeEntryView | null`
- `GET /v1/labor/free-projects` → `[]`
- `GET /v1/time-tracker/jobs` → `[]`

Then start web with:
`SEMSE_API_BASE_URL=http://127.0.0.1:4000 NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true SEMSE_TENANT_ID=tenant_default SEMSE_ORG_ID=org_pro_001 SEMSE_USER_ID=usr_worker_001 SEMSE_ROLES=PRO pnpm dev:web`

Types live in `apps/web/app/(app)/labor-api.ts`. Keep fixture minutes small and
round (e.g. week 60 min, month 120 min) so KPI arithmetic in the UI is
unambiguous and a broken range filter produces a visibly different number.

## Simulating offline / pending (unsynced) work

Instead of physically going offline, seed `localStorage` key
`semse.worker.tracker.failsafe.v1` (`apps/web/app/(app)/worker/tracker/trackerLocalStore.ts`)
before loading the page, then navigate to the tracker. **Seed from another route
(e.g. `/worker/dashboard`) and then navigate** — writing the key while already on
`/worker/tracker` can be overwritten by the tracker's own in-memory/unload persistence:

```json
{"version":1,"syncStatus":"pending","activeSession":null,
 "pendingEvents":[{"id":"evt_1","type":"manual_session","purpose":"payable",
   "date":"YYYY-MM-DD","startTime":"08:00","endTime":"10:00","breakMinutes":0,
   "hourlyRate":10,"currency":"USD","notes":"PENDIENTE hoy 2h",
   "localTimestamp":"2026-01-01T00:00:00.000Z"}]}
```

- A pending *active session* is `activeSession` with `status:"RUNNING"` and
  `accumulatedSeconds`; `backendSessionId` present means the backend already
  knows about it (relevant to double-counting logic in `pendingLocalEntries`).
- Pending work is rendered with the badge "Pendiente de sincronizar"; the
  "Esta semana" KPI shows the hint "incluye horas pendientes de sincronizar".
- Tab labels: Timer / Resumen / Registros / Proyectos / Reportes / Asistente.
  Registros range `<select aria-label="Rango">` options: "Últimos 7 días",
  "Últimos 30 días", "Todo el historial". KPI "Horas del filtro" shows the
  filtered total (`fmtHours`, es-MX, e.g. `3h`).

## Testing the offline-queue auto-sync / retry behaviour

The tracker auto-syncs `pendingEvents` on mount. A bug class here is the effect
re-triggering itself (each attempt rewrites local state → effect re-runs), which
shows up as very fast flicker plus hundreds of POSTs per second.

- **Best signal is the request count, not the screen:**
  `grep -c "POST /api/semse/labor/entries/manual" /tmp/web.log` sampled before/after a
  time window; cross-check the API side with
  `grep -c '"path":"/v1/labor/entries/manual"' /tmp/api.log` (note: the API logs
  ~2 lines per request — request + exception/completion — so divide).
- Expected healthy behaviour (post-#432): non-retryable 4xx → exactly 1-2 POSTs and
  auto-sync stops; retryable failures (API down / 5xx) → exponential backoff
  `min(5s * 2**(n-1), 5min)` capped at 6 attempts, then stop. Banner text switches
  between "Seguiremos intentando automáticamente." and "…usa \"Reintentar ahora\"…".
- To simulate a retryable outage, kill the API **by PID** (`ps aux | grep "[n]est start"`),
  not with a broad `pkill -f` that can match your own shell.
- Manual recovery: restart the API, click "Reintentar ahora" → green
  "Sincronización completada", stale red error banner cleared, KPIs updated.
- **Use a unique `clientEventId`/event `id` per run** (e.g. `evt_retry_${Date.now()}`).
  Manual-entry creation is idempotent on that id, so a reused id silently returns the
  old DB row and your "new" hour never appears.
- To prove a test actually detects the bug, temporarily restore the pre-fix file
  (`git show <fixcommit>^:path > path`), reproduce, then `git checkout -- path`.

## Known trap

KPI cards are computed as `summary.totalMinutes + pendingSeconds`, and the
backend summary only counts `completed` entries. Any change to which local
entries are emitted as "pending" can therefore make a *running synced* timer
disappear from KPI cards while still being correct in the list aggregates —
check both the KPI cards and the Registros/Reportes aggregates when testing
changes to `pendingLocalEntries`.

## Devin Secrets Needed

None — demo login and the stub API require no secrets.
