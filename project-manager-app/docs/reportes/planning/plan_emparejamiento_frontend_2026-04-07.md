# Plan: Emparejamiento completo del frontend con el backend

Fecha: 2026-04-07
Estado del proyecto al momento del análisis:
- 18 páginas frontend totales
- 5 páginas conectadas a API real
- 8 páginas con datos mock pero UI completa
- 1 página crítica faltante (`/client/jobs/[jobId]`)
- Todos los proxy routes de field-ops ya existen pero las páginas no los llaman

---

## Tareas en orden de prioridad

### P0 — Cierra el MVP
1. Crear `/client/jobs/[jobId]/page.tsx` (no existe)
2. Crear proxy: `GET /api/semse/jobs/[jobId]/payments` → `/v1/jobs/:jobId/payments`
3. Crear proxy: `GET /api/semse/jobs/[jobId]/contracts/current` → `/v1/jobs/:jobId/contracts/current`

### P1 — Conectar páginas con UI lista
4. `/client/milestones/page.tsx` — reemplazar `MILESTONES_DATA` con `fetchJobs()` + `fetchJobMilestones(jobId)`
5. `/client/payments/page.tsx` — reemplazar `TRANSACTIONS` con `fetchJobPayments(jobId)` vía `/api/semse/jobs/[jobId]/payments`
6. `/admin/field-ops/page.tsx` — reemplazar DEMO_* con calls reales (proxies ya existen)
7. `/worker/tracker/page.tsx` — reemplazar `JOBS` mock con `fetchJobs()` real

### P2 — Proxies faltantes en ops
8. Crear proxy: `GET /api/semse/ops/audit` → `/v1/ops/audit`
9. Crear proxy: `GET /api/semse/ops/trust-overview` → `/v1/ops/trust-overview`
10. Crear proxy: `GET /api/semse/ops/risk-scores` → `/v1/ops/risk-scores`
11. Crear proxies: `/api/semse/organizations/*` → `/v1/organizations/*`

---

## Prompt para Codex (ver archivo adjunto)
Ver: `reportes/prompts/prompt_codex_frontend_emparejamiento_2026-04-07.md`
