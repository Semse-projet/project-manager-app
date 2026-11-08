---
type: tasks
feature: "Decision Ledger"
domain: "prometeo"
plan: "docs/specs/prometeo/decision-ledger.plan.md"
version: "2.1"
status: "PENDING"
branch: "feat/decision-ledger"
date: "2026-11-06"
---

# Tasks: Decision Ledger

## Fase 0 — Gobierno
- [ ] [DL-001] Owner acepta ADR-044 con fecha y aprueba el acta
- [x] [DL-002] Owner resuelve Q-1 a Q-9 del spec (2026-11-06; topes, SLO, retención y tenant del canary pendientes)
- [ ] [DL-003] Owner aprueba el spec (`REVIEW` → `APPROVED`)
- [ ] [DL-004] Registrar la FSM en `docs/foundation/STATE_MACHINES.md`
- [ ] [DL-005] Registrar los eventos en `docs/foundation/EVENT_CATALOG.md`
- [ ] [DL-006] Refrescar `main` y reconciliar `related_files`

## Fase 1 — Pruebas en rojo
- [ ] [DL-010] Registro único con autoridad, fuentes y AuditLog
- [ ] [DL-011] Reintento idempotente y 409 por contenido distinto
- [ ] [DL-012] `UPDATE`/`DELETE` rechazados, también por SQL directo
- [ ] [DL-013] Corrección, anulación y estado derivado; segunda corrección concurrente rechazada
- [ ] [DL-014] Aislamiento 2 tenants × 2 organizaciones (404/403) y autorización contra el sujeto
- [ ] [DL-015] El efecto referencia `executionId` de H05 y no copia resúmenes
- [ ] [DL-016] Autoridad inválida, fuente sin `tenantId` y `subjectType` fuera del catálogo rechazados
- [ ] [DL-017] `rationale` redactado y acotado

## Fase 2 — Datos
- [ ] [DL-020] Modelos Prisma y migración aditiva
- [ ] [DL-021] *Trigger* de inmutabilidad y `onDelete: Restrict`
- [ ] [DL-022] Probar la migración sobre una copia y la compatibilidad hacia atrás
- [ ] [DL-023] Autorización del owner para aplicar la migración

## Fase 3 — Dominio
- [ ] [DL-030] Contratos Zod en `packages/schemas/src`
- [ ] [DL-031] Repositorio y servicio `recordAuthorizedDecision(input, tx?)`
- [ ] [DL-032] Validación de autoridad, política y aprobación
- [ ] [DL-033] Adaptador de outbox para productores sin transacción compartida
- [ ] [DL-034] Permisos de lectura y anulación en `rbac.ts`

## Fase 4 — API
- [ ] [DL-040] Lectura por id y por sujeto con paginación por cursor
- [ ] [DL-041] Auditoría de lecturas sin contenido
- [ ] [DL-042] Actualizar `SEMSE_API_SURFACE_V1.md`

## Fase 5 — Primer productor
- [ ] [DL-050] Integrar el productor elegido en Q-2 en modo `shadow` (sin filas)
- [ ] [DL-051] Validar telemetría de `shadow` antes de pasar a `canary`

## Fase 6 — Verificación
- [ ] [DL-060] Pruebas dirigidas y regresión
- [ ] [DL-061] build, typecheck y lint
- [ ] [DL-062] `pnpm spec:validate:strict`, `spec:coverage` y `spec:index`

## Fase 7 — Entrega
- [ ] [DL-070] Revisión del PR y CI en verde
- [ ] [DL-071] SHA de merge registrado
- [ ] [DL-072] Despliegue terminal verificado
- [ ] [DL-073] Canary autenticado con un tenant y un productor
- [ ] [DL-074] Metadatos SDD y evidencia de producción sin inventar estados
