# Reporte: Remediación UI Admin — Batch 2 y 3 (errores silenciados, relabel y honestidad de métricas)

**Fecha:** 2026-07-23
**Sesión:** https://app.devin.ai/sessions/ba935c8a8ed74204b9749846a3602aa6
**Rama:** `devin/1784813503-admin-remediation-ui`
**PR:** https://github.com/Semse-projet/project-manager-app/pull/387
**Solicitante:** @Samuelcastella

## Qué se hizo

Se continuó el backlog de remediación de UI/Admin (`docs/AUDIT_REMEDIATION_PLAN.md`, Sección 3), corrigiendo los lotes 2 y 3 de hallazgos de bajo riesgo que no tocan dinero, auth ni cross-tenant data. Para evitar conflictos en `AUDIT_REMEDIATION_PLAN.md` con el PR abierto del primer lote (#387), se fusionaron los cambios en la misma rama y se actualizó el PR.

## Hallazgos corregidos

| Ítem | Archivo(s) | Fix |
|---|---|---|
| **3.3** ALTO | `apps/web/app/(app)/admin/labor-engine/page.tsx` | `load` usa `Promise.allSettled` para `overview`/`rates`/`jobs`; fallos parciales se muestran como error en vez de dejar KPIs vacíos. |
| **3.29** MEDIO | `apps/web/app/(app)/admin/semse-x/page.tsx` | Se distingue visualmente lo sintético: "Nodos Cognitivos" y "Amenazas Neutralizadas" llevan etiqueta "(simulado)", `MetricCard` soporta `synthetic` y "Memoria Comprimida" / "API en Evolución" se marcan como simuladas. |
| **3.30** MEDIO | `apps/web/app/(app)/admin/mission-control/page.tsx`, `apps/web/app/(app)/admin/reports/page.tsx` | Se reemplazan `.catch(() => null/[])` silenciosos por `Promise.allSettled` + `res.ok`; se muestra un banner de falla parcial. |
| **3.32** BAJO | `apps/web/app/(app)/admin/semse-x/page.tsx` | Los 4 fetches iniciales ahora usan `Promise.allSettled` y renderizan un banner rojo si alguno falla. |
| **3.33** MEDIO | `apps/web/app/(app)/admin/communications/page.tsx` | `handleStatusChange` guarda el mensaje de error en `statusError` y lo muestra debajo de los botones Reabrir/Pendiente/Cerrar. |
| **3.39** MEDIO | `apps/web/lib/admin/admin-navigation.ts`, `apps/web/app/(app)/admin/workops/page.tsx` | Relabel: el menú y el quick link a `/admin/worker` ahora dicen "Worker Queue" y describen el monitor BullMQ real, en vez de prometer perfiles/asignaciones. |
| **3.41** BAJO | `apps/web/lib/admin/admin-navigation.ts` | Relabel de `/admin/html-in-canvas` a "HTML-in-Canvas Demos" con descripción honesta de 4 demos fijos del spec WICG. |

## Validación

- `pnpm lint` — 0 errores, 54 warnings preexistentes.
- `pnpm typecheck` — pasa.
- `pnpm build:api` — pasa.
- `pnpm build:web` — pasa (via `pnpm spec:preflight`).
- `pnpm test:unit` — 944 pass / 0 fail.
- `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- `pnpm spec:preflight` — pasa.

## Notas y próximos pasos

- Quedan pendientes los ítems de dinero, auth y cross-tenant (3.7, 3.8, 3.9, 3.10–3.15, etc.) que requieren sign-off humano explícito según `semse-audit-remediation`.
- Varias correcciones dependen de verificación en vivo con credencial `OPS_ADMIN`, no disponible en esta sesión.
- No se modificó `packages/db/prisma/schema.prisma`.
- No se expusieron secretos ni credenciales.
