---
type: plan
feature: "Project Lifecycle Projection F3"
domain: "operations"
spec: "docs/specs/operations/project-lifecycle-projection.spec.md"
version: "2.0"
status: "COMPLETE"
branch: "main"
date: "2026-07-31"
---

# Plan técnico: Project Lifecycle Projection F3

## 1. Snapshot

- F3 mergeado: `f1234291`; `origin/main` y los cuatro servicios están en
  `114cb9ca`, que contiene F3.
- PostgreSQL: migraciones F3, reloj Evidence y repair canónico aplicados.
- Evidence: nueve columnas tenant/context, cero tenant nulo, dos FKs y tres
  índices verificados.
- F3: cálculo y persistencia activos sólo para `tenant_default`.
- Proyección durable: una fila canary, revisión estable y mismatch cero.
- Evento `project.lifecycle-source-changed.v1`, consumer
  `project-lifecycle-projection.v1` y rebuild tenant-scoped desplegados.
- Canary event-driven: 5 outbox `PUBLISHED`, 5 receipts `COMPLETED`, cero
  pending/failed/dead-letter; replay idempotente `no_op`.
- El primer canary falló por drift Evidence; rollback y forward-fix quedaron
  probados antes del canary exitoso.
- Los dos primeros jobs del canary event-driven fallaron 403 porque el Worker
  no tenía `EVENT_CONSUMER`; el rol se corrigió y ambos eventos se
  reconciliaron una sola vez antes de verificar consumo automático.

## 2. Rescate selectivo

Reutilizar:

- SQL exacto y modelo Prisma.
- Estructura base del Zod schema.
- BFF y panel como punto de partida.
- Test de CAS como intención.

Reescribir/mejorar:

- revision hash y sourceUpdatedAt completo;
- progreso por trabajo aprobado/pagado;
- gastos, riesgo y evidencia requerida;
- flags/allowlist;
- separación cálculo/persistencia;
- tests de ownership y concurrencia;
- estados UX y observabilidad.

No rescatar cambios ajenos de móvil, disputas, tracker, layout o deploy scripts.

## 3. Archivos

```text
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/20260728000000_project_lifecycle_projection/migration.sql
packages/schemas/src/project.schema.ts
packages/schemas/src/domain-events-v2.schema.ts
packages/shared/src/index.ts
apps/api/src/modules/projects/project-lifecycle-projection.ts
apps/api/src/modules/projects/projects.repository.ts
apps/api/src/modules/projects/projects.service.ts
apps/api/src/modules/projects/projects.controller.ts
apps/api/src/modules/domain-events/project-lifecycle-projection-event-producer.service.ts
apps/api/src/modules/domain-events/domain-event-consumer.service.ts
apps/api/src/modules/domain-events/domain-events.module.ts
apps/api/test/project-lifecycle-projection*.test.ts
apps/api/test/projects.controller.test.ts
apps/api/test/evidence-outbox-producer.test.ts
apps/api/src/modules/buildops/buildops.service.ts
apps/api/src/modules/buildops/buildops.types.ts
apps/api/test/buildops-project-canonical-link.test.ts
apps/web/app/api/semse/projects/[projectId]/projection/route.ts
apps/web/components/projects/ProjectLifecycleProjectionPanel.tsx
apps/web/app/lib/buildops-api.ts
apps/web/app/(app)/buildops/projects/[projectId]/page.tsx
apps/web/app/(app)/client/projects/[projectId]/page.tsx
docs/architecture/SEMSE_API_SURFACE_V1.md
docs/foundation/EVENT_CATALOG.md
```

## 4. Implementación por fases

### A — Reconciliación

Restaurar SQL, comparar SHA-256, agregar modelo Prisma y generar cliente.

### B — Contrato y tests

Actualizar Zod schema; escribir tests de cálculo, seguridad, CAS y controller.

### C — API y persistencia

Implementar builder puro; repository tenant-scoped; persistencia CAS sólo con
flag; endpoint con permission y allowlist.

### D — BuildOps/Web

Exponer `canonicalProjectId`; BFF; panel reutilizable; estados explícitos.

### E — Verificación

Build packages/API/Web, tests dirigidos y regresión, lint/typecheck, spec
strict, diff/checksum.

### F — Integración/producción

PR/CI/merge; crear flags OFF sin redeploy independiente cuando sea posible;
deploy con pre-deploy; tenant canary; persist canary; métricas; promover o
rollback.

### G — Rebuild/event invalidation

Completado: contrato versionado, hooks de fuentes, rebuild tenant-scoped,
consumer/receipt/audit idempotentes y replay. Evidence registra su invalidación
en la misma transacción; los demás hooks son post-commit best-effort y usan el
read-through/rebuild como recuperación.

### H — Canary event-driven

Desplegar default-off; activar producer/dispatcher/consumer/type allowlists
para `tenant_default`; confirmar rol `EVENT_CONSUMER`; provocar eventos,
verificar outbox y receipt; repetir entrega; ejecutar replay y confirmar
`no_op`, revisión estable y ausencia de errores.

## 5. Rollback

- Flags de proyección OFF detienen endpoint/persistencia read-through.
- `SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED=false` detiene nuevos eventos F3.
- Retirar el evento/consumer de allowlists pausa dispatch/consumo sin borrar
  outbox ni receipts.
- Código anterior sigue compatible porque migración es aditiva.
- No borrar tabla en rollback.
- Si checksum no coincide, detener deploy y reconciliar; no usar `resolve` sobre
  una migración exitosa.

## 6. SLO de canary

- Endpoint P95 < 750 ms en canary.
- Error 5xx < 1%.
- Cero fugas cross-tenant/org.
- Snapshot mismatch durable/calculado = 0 para revisiones iguales.
- Cero escrituras Payment/Project/Milestone desde el endpoint.

El gate F3 se verificó para el canary `tenant_default`. P95 y error rate de una
ventana sostenida siguen siendo condición para promoción global, no evidencia
para afirmar que el canary actual ya es global.
