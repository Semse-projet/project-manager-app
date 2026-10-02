# Guarda de arquitectura de ResourceScope (C51 etapa 3B)

Estado: **informativa (report-only)** · Spec: `docs/specs/platform/resource-scope.spec.md` §3.2–§3.3 · Autorizada por el dueño (2026-10-01) como PR de CI separado.

## Qué hace
`scripts/architecture/resource-scope-inventory.mjs` inventaría los endpoints de `apps/api` que direccionan un recurso (`:param` de ruta o query `...Id`/`...Ids`) y estima, por **AST de TypeScript** (no por grep), si su cadena `controller → servicio → repositorio/política` (hasta 2 niveles) importa el contrato `common/resource-scope*` (`scoped`) o una política/acceso de dominio (`domain-policy`). Estados: `scoped`, `domain-policy`, `allowlisted`, `public-unscoped`, `no-evidence` (candidatos).

`@RequirePermissions` por sí solo **no** cuenta como evidencia de scope: un permiso no dice de quién es el recurso.

## Qué NO es
No es un gate de seguridad. La evidencia es estática y por módulo: hay **falsos positivos** (la política se aplica por otra vía, o el recurso no es de proyecto) y **falsos negativos** (se importa la política pero no se usa en esa ruta). Por eso:
- el modo por defecto es `report` y **nunca falla**; el workflow (`.github/workflows/resource-scope-guard.yml`) lleva `continue-on-error` y no es un check requerido;
- `--mode=enforce` existe pero **no está conectado a CI**: volverlo bloqueante es **otro PR**, tras un ciclo completo verde y la revisión de falsos positivos.

## Allowlist (`docs/architecture/resource-scope-allowlist.json`)
Excepciones reales y documentadas: `{ "file": "modules/x/x.controller.ts", "handler": "get" | "*" (opcional), "reason": "motivo explícito (≥10 caracteres)" }`. Una entrada sin motivo **no exime** y se informa como error; las entradas que ya no coinciden con ninguna ruta se informan como obsoletas. **No se rellena en masa**: cada entrada se añade al revisar un candidato concreto.

## Clases conocidas de falsos positivos a revisar en la fase siguiente
El contrato ResourceScope es centrado en proyecto. Recursos con otro dueño (fincas/agro, leads de contratista, árboles de conocimiento sin tenant, runtime de desarrollador, finanzas por proyecto con su propio servicio) aparecen como candidatos aunque tengan su propia autorización. Cada uno se clasifica como: (a) migrar a política/resolver, (b) allowlist con motivo, o (c) mejorar el detector.

## Uso local
`node scripts/architecture/resource-scope-inventory.mjs [--markdown=out.md] [--json=out.json]`
Pruebas: `tests/unit/resource-scope-inventory.test.mjs` (corren dentro de `pnpm test:unit`).
