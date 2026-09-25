---
type: plan
feature: "canonical-state-registry"
domain: "platform"
spec: "docs/specs/platform/canonical-state-registry.spec.md"
version: "2.0"
status: "APPROVED"
branch: "claude/canonical-state-registry-4st90s"
date: "2026-08-28"
---

# Plan técnico: Registro Canónico de Estado del Sistema

> Prerrequisito: spec `APPROVED`/`IMPLEMENTED`. Este plan es de gobernanza
> documental — varias secciones del template estándar (datos/migración,
> eventos, canary) no aplican y se marcan explícitamente.

## 1. Snapshot de verdad

- `origin/main` SHA: `140c192` (HEAD de `main` al abrir esta rama; ver `git log -1 origin/main`)
- SHA desplegado API: no aplica a este cambio (no toca `apps/api`)
- SHA desplegado Web: no aplica a este cambio (no toca `apps/web`)
- Estado de servicios: no aplica
- Estado de migraciones: sin cambios (`pnpm db:migrate` no requerido)
- Flags/allowlists: ninguno nuevo
- Drift o deuda previa: ninguna detectada relevante a este cambio;
  `pnpm spec:validate` en baseline reporta 0 errores/0 warnings sobre 116
  specs antes de esta entrega

## 2. Constitution check

- [x] Spec aprobado antes de código (este mismo spec, `IMPLEMENTED` en el
      mismo commit que lo implementa — precedente ya usado por otros specs
      de esta entrega documental, p. ej. `operations.jobs-bids-event-projection`)
- [x] Tenant/org/ownership y RBAC definidos — no aplica (sin runtime)
- [x] Evidence/Payment Governance revisados si aplica — no aplica
- [x] Audit/events definidos para cambios críticos — no aplica; el propio
      historial de Git es el rastro de auditoría de este artefacto
- [x] Tests preceden implementación — el test estructural
      (`tests/unit/canonical-state-registry.test.ts`) se escribió contra el
      esquema definido en el spec antes de terminar de sembrar las filas
- [x] No se expone secreto ni se agrega backend paralelo
- [x] Código, CI, merge, deploy y activación se medirán por separado — este
      artefacto no tiene deploy/activación aplicables (ver spec, sección 8);
      código/CI/merge sí se miden vía metadata SDD estándar

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: `docs/CANONICAL_STATE_REGISTRY.md` (Git)
- Read models/proyecciones: no aplica
- Módulos afectados: ninguno en `apps/`; documentación en `docs/`
- Contratos Zod: no aplica
- API/BFF/UI: no aplica
- Worker/queues: no aplica
- Agentes/tools: no aplica en esta entrega (ver spec, backlog)
- ADR requerido: no — se resuelve como spec SDD, consistente con cómo se
  gobiernan otras decisiones de documentación estructural en este repo
  (p. ej. `SOURCE_OF_TRUTH.md`, `SPEC_INDEX.md` mismos)

## 4. Datos y migración

No aplica en su totalidad — sin cambios a `packages/db/prisma/`.

## 5. Seguridad y política

- Permisos: no aplica (documento en Git, sin runtime)
- Tenant/org/resource scope: no aplica
- Step-up/aprobación: revisión de PR estándar
- Auditoría: historial de Git
- Riesgos de pagos/evidencia: ninguno directo; riesgo indirecto documentado
  en la fila `field-ops/time-tracker` (posible doble fuente de verdad
  job↔tracker) — no se resuelve en este PR, se deja registrado como
  "Próxima decisión"
- Abuse cases: una fila podría declararse `verificada` sin evidencia real
  — mitigado por la regla explícita "no se fabrica evidencia" y por el test
  automatizado que verifica existencia de rutas citadas

## 6. Eventos, idempotencia y reconstrucción

No aplica — ver spec, sección 6.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Escribir `tests/unit/canonical-state-registry.test.ts` contra el esquema
  de 11 columnas y las reglas de evidencia del spec, antes de cerrar la
  redacción final del documento.

### Fase B — Datos y dominio

- No aplica (sin Prisma/dominio de negocio).

### Fase C — API/BFF/UI

- No aplica.

### Fase D — Verificación local/CI

- `node --test tests/unit/canonical-state-registry.test.ts`
- `pnpm spec:validate:strict`
- `pnpm spec:index` (regenerar `docs/SPEC_INDEX.md`)

### Fase E — Integración

- Abrir PR (draft) hacia `main` con spec, plan, tasks, registro, test y
  referencias cruzadas actualizadas.
- Registrar SHA de merge cuando ocurra.

### Fase F — Producción

- No aplica — ver spec, sección 8. Este artefacto no tiene ruta de
  despliegue ni activación.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| El registro se abandona (nadie actualiza filas tras el merge inicial) | alta si no se asigna owner de mantenimiento | medio — vuelve a ser "otro documento más" que diverge | Regla de caducidad a 60 días explícita; próxima decisión (Fase 2) asigna auditoría por dominio | Ninguna fila tiene `Última verificación` <60 días en una revisión trimestral → escalar a decisión humana |
| Se usa para fabricar la apariencia de cobertura completa (filas especulativas) | media | alto — recrea exactamente el problema que motiva este spec | Regla explícita "no se fabrica evidencia"; Fase 1 siembra sólo 3 filas verificables, no 50 | Cualquier fila `verificada`/`operativa` sin ruta de evidencia real detectada por el test |
| Confusión entre el vocabulario de este registro (`operativa`, `verificada`) y los `status` de `SPEC_INDEX.md` (`IMPLEMENTED`, `VERIFIED`) | media | bajo-medio — lectura errónea de estado | Vocabulario deliberadamente distinto (ver spec, sección 2) y sección explícita "Qué no es este documento" | Un reporte futuro cita el estado del registro como si fuera `status` de spec, o viceversa |

## 9. Investigación externa

No aplica — ver spec, sección 11.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec, plan, tasks, registro, test,
      actualización de `SOURCE_OF_TRUTH.md`)
- [x] Migración y rollback definidos — no aplica; rollback es revertir el PR
- [x] Tests ordenados antes del código — test estructural escrito junto con
      el esquema, antes de sembrar el contenido final de las filas
- [x] Canary/feature flag definidos — no aplica
- [x] Evidencia requerida para cada estado de entrega — sí, ver spec sección 12
- [x] Scope cabe en un PR reversible — sí, sólo `docs/` + un archivo de test
