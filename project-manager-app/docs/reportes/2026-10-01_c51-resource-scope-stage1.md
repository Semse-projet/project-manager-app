# C51 — ResourceScope, etapa 1 (2026-10-01)

## Hecho
- `common/resource-scope.ts`: contrato único (`hasScopeAccess`, `assertScopeAccess`, `sameOrg`, `isOpsAdmin`, `scopeFromOwnership`). OPS_ADMIN no cruza tenants; cross-tenant ⇒ 404; org vacía nunca coincide.
- Políticas delegadas (API pública y mensajes intactos): evidence, milestones, disputes (lectura + liquidación del cliente), projects (lectura/finanzas/estado), liens. `organizations` y `trust` usan `sameOrg`/`isOpsAdmin`.
- **Bug cerrado:** `actor.orgId === ownership.assignedProOrgId` con `""` en ambos lados concedía acceso (proyecto sin profesional asignado + actor sin org). Solo `liens` lo protegía.
- Tests: `resource-scope.test.ts` (7): matriz de relaciones, cross-tenant (404, también OPS_ADMIN), cross-org (403), org vacía, **paridad** de las 5 políticas con el contrato y cierre del caso vacío en evidence/milestones/disputes/projects. `disputes-policy` y `milestones-policy` pasan a importar `dist` (el modo strip-types no resuelve el nuevo import `.js`); sus aserciones no cambian.
- `tsc` limpio; suite API **2635 pass / 0 fail**.

## Límite de la etapa 1
El tenant de las políticas de dominio se toma del actor porque su `ownership` ya viene filtrado por tenant desde los repositorios (el cruce de tenant lo sigue cerrando el repositorio con 404). La etapa 3 mueve eso a un resolutor único.

## Siguiente (etapa 2)
Inventario de comparaciones manuales de `orgId` fuera de políticas y migración de `ratings`, `originator`, `users`, `contributor-program`, `domain-events`, con tests negativos por módulo.
