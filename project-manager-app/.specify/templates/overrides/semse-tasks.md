---
type: tasks
feature: "[FEATURE_NAME]"
domain: "[DOMAIN]"
plan: "docs/specs/[dominio]/[feature].plan.md"
version: "1.0"
status: "[PENDING | IN_PROGRESS | DONE]"
branch: "feat/[feature-slug]"
date: "[YYYY-MM-DD]"
---

# Tareas: [FEATURE_NAME]

> **Prerequisito:** El plan `[feature].plan.md` debe estar APPROVED.
> Convención de estado: `[ ]` pendiente · `[x]` completado · `[~]` bloqueado
> Convención de paralelismo: `[P]` puede ejecutarse en paralelo con otras `[P]`

---

## Fase 1 — Setup

- [ ] [T-001] Crear rama `feat/[feature-slug]` desde `main`
- [ ] [T-002] Escribir tests del spec ANTES de implementar (ver sección Tests del spec)
- [ ] [T-003] [P] Crear migración Prisma si aplica: `pnpm db:generate`
- [ ] [T-004] [P] Crear schema Zod en `packages/schemas/src/[dominio].ts`

---

## Fase 2 — Foundational ⚠️ COMPLETAR ANTES DE CONTINUAR

> Esta fase es bloqueante. No avanzar a Fase 3 sin completarla.

- [ ] [T-010] Implementar service `[NombreModulo]Service.[método]`
  - Archivo: `apps/api/src/modules/[nombre]/[nombre].service.ts`
  - Debe respetar: `DOMAIN_INVARIANTS.md`
  - Debe usar: estados de `STATE_MACHINES.md`
- [ ] [T-011] Verificar que los tests de T-002 pasen con la implementación del service
- [ ] [T-012] Correr `pnpm test:unit` — todos deben pasar

---

## Fase 3 — API Contract

- [ ] [T-020] Agregar endpoint al controller
  - Archivo: `apps/api/src/modules/[nombre]/[nombre].controller.ts`
  - Decorar con: `@Roles([ROL])`, `@UseGuards(AuthGuard, RolesGuard)`
  - Validar input con schema Zod de T-004
- [ ] [T-021] Registrar endpoint en `docs/architecture/SEMSE_API_SURFACE_V1.md`
- [ ] [T-022] Correr tests de integración del endpoint
- [ ] [T-023] Verificar que errores 400/403/404/409 retornan correctamente

---

## Fase 4 — Efectos del Dominio

- [ ] [T-030] Emitir evento audit `[aggregate.action]` en el servicio
  - Verificar formato con `docs/foundation/EVENT_CATALOG.md`
- [ ] [T-031] [P] Emitir SSE si el spec lo requiere
  - Canal: `apps/api/src/modules/[nombre]/[nombre]-sse.service.ts`
- [ ] [T-032] [P] Emitir notificación si el spec lo requiere
- [ ] [T-033] Si toca pagos: verificar Payment Governance harness
  - Referencia: `docs/agents/harnesses/contrato_tecnico_payments_harness_semse_2026-04-05.md`

---

## Fase 5 — Frontend (si aplica)

- [ ] [T-040] Crear/modificar página en `apps/web/app/[ruta]/page.tsx`
- [ ] [T-041] [P] Crear BFF route si el page necesita llamada server-side
- [ ] [T-042] [P] Crear componentes en `apps/web/components/` o `packages/ui/`
- [ ] [T-043] Verificar con `pnpm typecheck` — sin errores TypeScript

---

## Fase 6 — Polish y Cierre

- [ ] [T-050] Correr suite completa: `pnpm test`
- [ ] [T-051] Correr typecheck: `pnpm typecheck`
- [ ] [T-052] Verificar lint: `pnpm lint`
- [ ] [T-053] Actualizar `docs/SPEC_INDEX.md`: cambiar status del spec a `APPROVED`
- [ ] [T-054] Crear reporte de sesión: `docs/reportes/[feature]_[fecha].md`
- [ ] [T-055] Commit con mensaje descriptivo siguiendo convención del repo
- [ ] [T-056] Abrir PR a `main` si está listo para review

---

## Criterio de Done

- [ ] Todos los tests del spec pasan en CI
- [ ] El endpoint está en `SEMSE_API_SURFACE_V1.md`
- [ ] El spec está en `APPROVED` en `SPEC_INDEX.md`
- [ ] No hay regresiones en la suite existente (`pnpm test`)
- [ ] El reporte de sesión fue creado
