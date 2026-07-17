# Reporte: Implementación del skill `materiales-obra`

**Fecha:** 2026-07-17  
**Rama:** `devin/materiales-obra-skill`  
**Scope:** Módulo reutilizable de cálculo de materiales, endpoint `/v1/tools/materials` e integración Prometeo.

## Resumen

Se codificó el skill `apps/api/skills/materiales-obra/SKILL.md` como un módulo puro en `@semse/tools`, se expuso vía API REST y se registró como herramienta de lectura en Prometeo (`materials.calculate`).

## Cambios principales

- `packages/tools/src/materials/materials-calculator.ts`: motor puro con 6 categorías (pintura, drywall, pisos, concreto, madera, mulch) y validación estricta de input.
- `packages/tools/src/index.ts`: re-exporta `calculateMaterials`, `MaterialsCalculatorError` y los tipos `Materials*Input`.
- `apps/api/src/modules/tools/tools.service.ts` + `tools.controller.ts`: método `materials(input)` y `POST /v1/tools/materials` con permiso `tools:run`.
- `apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts`: dispatch de `materials.calculate`.
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`: registro de la herramienta Prometeo.
- `tests/unit/materials-calculator.test.mjs`: cobertura de todas las categorías y casos de error.
- `docs/specs/tools/materials-calculator.spec.md`: spec SDD aprobado.
- `docs/SPEC_INDEX.md`: regenerado con `pnpm spec:index`.

## Validación

| Comando | Resultado |
|---|---|
| `pnpm lint` | 0 errores (54 warnings preexistentes en web) |
| `pnpm typecheck` | pass |
| `pnpm test:unit` | 806 pass / 0 fail / 5 skipped |
| `pnpm --filter @semse/api test:unit` | 1838 pass / 0 fail |
| `pnpm spec:preflight` | pass |
| `pnpm exec node scripts/semse-health-check.mjs` | 97/100 (advertencia preexistente `_satellites-archive`) |

## Notas

- No se modificó `packages/db/prisma/schema.prisma`.
- El cálculo es idempotente y sin estado; no requiere FSM ni eventos.
- La herramienta Prometeo devuelve `__blockedReason` cuando el input es inválido.
