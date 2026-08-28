---
type: tasks
feature: "canonical-state-registry"
domain: "platform"
plan: "docs/specs/platform/canonical-state-registry.plan.md"
version: "2.0"
status: "PARTIAL"
branch: "claude/canonical-state-registry-4st90s"
date: "2026-08-28"
---

# Tareas: Registro Canónico de Estado del Sistema

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
> Fase 1 es esta entrega. Fase 2 es backlog explícito, no implícito: no se
> asume completa hasta que alguien la ejecute y la marque.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `IMPLEMENTED` e indexable vía `pnpm spec:index`
- [x] [T-002] Registrar SHA de `origin/main` y estado de baseline
      (`pnpm spec:validate` limpio: 0 errores/0 warnings sobre 116 specs)
- [x] [T-003] Completar plan; se omite `analyze`/`checklist` formales
      separados para esta entrega documental — el propio spec (sección 12)
      y plan (sección 8/10) cubren sus gates
- [x] [T-004] Registrar investigación externa y decisiones (spec, sección 11)

## Fase 1 — Infraestructura del registro (esta entrega)

- [x] [T-010] Escribir test estructural rojo→verde:
      `tests/unit/canonical-state-registry.test.ts` valida existencia del
      documento, presencia de las 11 columnas del esquema y existencia real
      de las rutas citadas como evidencia en filas `operativa`/`verificada`
- [x] [T-011] Redactar `docs/CANONICAL_STATE_REGISTRY.md`: jerarquía de 9
      niveles, esquema de 11 campos, definición de `Estado real`, reglas de
      mantenimiento
- [x] [T-012] Sembrar 3 filas verificables en este commit (el propio
      registro, `field-ops/time-tracker` legacy, y
      `operations.project-lifecycle-projection` citando su spec `VERIFIED`)
      — sin fabricar evidencia para dominios no auditados
- [x] [T-013] Confirmar que el test falla si se cita una ruta de evidencia
      inexistente (verificado manualmente contra el esquema antes de cerrar
      las filas finales)
- [x] [T-014] Referenciar el registro desde `docs/SOURCE_OF_TRUTH.md` como
      instrumento operativo de sus ejes de verdad existentes, sin duplicar
      ni contradecir esa jerarquía de 6 ejes

## Fase 2 — Auditoría por dominio (backlog explícito, NO ejecutado en esta entrega)

- [ ] [T-020] Auditar SEMSE Core y sembrar sus filas con evidencia real
- [ ] [T-021] Auditar Connect y sembrar sus filas con evidencia real
- [ ] [T-022] Auditar Payments/Trust (escrow, disputes, evidence) y sembrar
      sus filas — riesgo `pagos`, requiere doble verificación por Artículo
      IV de la constitución
- [ ] [T-023] Auditar AI/Prometeo y sembrar sus filas
- [ ] [T-024] Auditar Agro y sembrar sus filas
- [ ] [T-025] Auditar BuildOps y sembrar sus filas
- [ ] [T-026] Auditar Knowledge y sembrar sus filas
- [ ] [T-027] Auditar Integrations y sembrar sus filas
- [ ] [T-028] Auditar Labor Engine vs. `field-ops` legacy en profundidad
      (más allá de la fila sembrada en Fase 1) y decidir plan de remoción
- [ ] [T-029] Decidir si automatizar este registro vía `pnpm spec:index` o
      mantenerlo manual con revisión de PR
- [ ] [T-030] Decidir si integrar la validación estructural a
      `pnpm verify:workspace`

## Fase 3 — Verificación local

- [x] [T-040] Tests dirigidos: `node --test tests/unit/canonical-state-registry.test.ts`
- [x] [T-041] Regresión proporcional al riesgo: `pnpm test:unit` completo
- [x] [T-042] Build/typecheck/lint: no aplica cambio de código de producto;
      se corre igualmente por precaución si el gate del repo lo exige
- [x] [T-043] `pnpm spec:validate:strict`
- [x] [T-044] `pnpm spec:index`
- [x] [T-045] Spec permanece en `status: IMPLEMENTED`, `code_status: COMPLETE`

## Fase 4 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos
- [ ] [T-051] Abrir PR (draft) con esta entrega
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope (Fase 2 queda fuera de este PR)
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 5 — Deploy y activación

- No aplica — ver spec, sección 8. Este artefacto no tiene ruta de deploy ni
  activación; su "entrega" termina en merge.

## Criterio de Done (de esta entrega, Fase 1)

- [x] Código (documentación + test) completo y test verde
- [ ] CI `PASS` (pendiente de PR)
- [ ] Merge `MERGED` (pendiente)
- [x] Deploy — no aplica
- [x] Migración `NOT_APPLICABLE`
- [x] Evidencia citada y verificable para cada fila sembrada
- [x] `SOURCE_OF_TRUTH.md` referencia el nuevo registro
- [ ] `SPEC_INDEX.md` regenerado y enlazando este spec (se ejecuta en Fase 3)
