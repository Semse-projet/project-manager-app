---
name: semse-labor-engine-boundary
description: The real boundary between the legacy field-ops/time-tracker code and the current Labor Engine — which API controllers, web pages, and mobile screens are live vs. legacy-only, so you don't invest in code destined for removal or "fix" a visual inconsistency that shouldn't be unified. Use before touching anything under field-ops, time-tracker, worker/tracker, admin/labor-engine, or apps/mobile/src/timer.
---

# SEMSE Labor Engine vs. legacy field-ops boundary

## The rule, and why it's easy to get wrong

`project-manager-app/CLAUDE.md`: "`field-ops/` — being replaced; new work goes to the Labor Engine" and "`field-ops/time-tracker` remains only as legacy API (jobs list still consumed) — `/worker/tracker` and `/admin/labor-engine` run fully on the Labor Engine." This reads like a clean one-line boundary, but the actual code has **three overlapping session-tracking API surfaces live at once**, which is exactly the kind of thing that produces a confused "why are there two trackers" finding (see `2.6 MEDIO` in `docs/AUDIT_REMEDIATION_PLAN.md`, explicitly left `[ ] Pendiente — fuera de alcance` for lack of a clear answer):

| Controller | Path | Status |
|---|---|---|
| `apps/api/src/modules/field-ops/time-tracker.controller.ts` | `v1/time-tracker` | Legacy — full session CRUD (`sessions/start`, `pause`, `resume`, `stop`, `manual`, `notes`, `summary`) still present, but per `CLAUDE.md` only the **jobs list** endpoint from this surface is still genuinely consumed. |
| `apps/api/src/modules/field-ops/field-ops.controller.ts` | `v1/field-ops` (with a `tracker/*` sub-surface) | Legacy — a *second*, near-duplicate session CRUD (`tracker/start`, `tracker/:id/pause`, etc.) alongside `units`/`worklogs`/`facts`/`vendors`, which are field-ops-specific concepts, not tracker duplication. |
| `apps/api/src/modules/labor-engine/labor-engine.controller.ts` | `v1/labor` | **Current** — this is what `/worker/tracker` and `/admin/labor-engine` actually call (confirmed via `apps/web/app/api/semse/labor/timer/start/route.ts` → `POST /v1/labor/timer/start`). |

**Before assuming any field-ops/time-tracker endpoint is dead code, check whether the specific endpoint is the "jobs list" one CLAUDE.md calls out as still consumed** — don't delete or "consolidate" it without confirming a real caller first (grep the web/mobile client wrappers for the exact path).

## Web surfaces

- `worker/field-ops` and `admin/field-ops` pages — legacy UI, styled dark/Tailwind per the 2.6 finding.
- `worker/tracker` (Timer/Resumen/Registros/Reportes tabs) and `admin/labor-engine` — current UI, styled light/CSS-var. See the `testing-worker-tracker` skill for how to actually exercise this one in a browser.

The visual-language split between these two families (2.6) is a *symptom* of the legacy/current split, not an independent bug — unifying the visual style of a page destined for removal is likely wasted effort. If someone wants to actually resolve 2.6, the real question to answer first is a product one: is `field-ops`'s remaining surface (units/worklogs/facts/vendors — not the tracker part) staying long-term, or is all of `field-ops` on a removal timeline? That answer isn't in the codebase; it needs a product decision, same category as the other "do not implement without a product decision first" items in `semse-audit-remediation`.

## Mobile

`apps/mobile/src/timer/localTimer.ts` is a **separate, mobile-only offline timer implementation** (AsyncStorage-backed) — it does not call into `v1/time-tracker` or `v1/field-ops`, and it isn't the same code as the web's `trackerLocalStore.ts`. See `semse-mobile-offline-sync` for detail. Don't assume a Labor Engine change on the API automatically covers mobile, or vice versa.

## Notas para futuros agentes / hallazgos abiertos

- No se determinó en esta sesión si `v1/time-tracker` y la parte `tracker/*` de `v1/field-ops` tienen ALGÚN caller real hoy más allá de la lista de jobs — sería el primer paso concreto para poder cerrar 2.6 con evidencia en vez de dejarlo "fuera de alcance" otra vez. Grepear los 4 archivos `-api.ts` del web (ver `semse-bff-pattern`) y `apps/mobile/src/api` por esos paths sería el punto de partida.
- `units`/`worklogs`/`facts`/`vendors` en `field-ops.controller.ts` no son parte de la duplicación de tracker — son conceptos propios de field-ops que no tienen equivalente confirmado en Labor Engine. No asumas que "migrar a Labor Engine" cubre esas cuatro cosas sin verificarlo.
- Esta skill no resuelve 2.6 — documenta por qué no se pudo resolver todavía y qué haría falta para intentarlo con criterio la próxima vez.
