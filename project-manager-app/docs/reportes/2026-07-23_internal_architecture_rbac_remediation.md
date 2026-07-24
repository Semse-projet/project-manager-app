# Remediación RBAC de herramientas internas de arquitectura

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Plan:** `0.21`

**Specs:** `api.rbac-explicit-boundary` v1.1 (`VERIFIED`) y
`ui.admin-flows-remediation` v1.2 (`APPROVED`, pendiente de prueba en vivo)

## Resultado

Las superficies `/anatomy`, `/knowledge`, `/repo-map` y `/runtime-map` dejaron
de depender del permiso general `knowledge:read`.

- `internal:architecture:read` existe solo en `OPS_ADMIN`.
- Anatomy, Repo Knowledge y Runtime Knowledge exigen ese permiso en todos sus
  handlers.
- Knowledge exige el permiso interno en `domains` y `overview`; workspace
  memory y agent skills conservan sus permisos funcionales para no romper a
  otros roles.
- Las cuatro páginas top-level entran ahora al middleware autenticado y solo
  el rol admin puede continuar.
- Las 18 rutas BFF internas usan la identidad de la sesión firmada.
- Si la sesión falta o es inválida, el BFF responde 401 y nunca sustituye al
  actor por la identidad estática del servidor.

## Brecha adicional cerrada

El hallazgo original se concentraba en el permiso demasiado amplio del API.
Durante la remediación se comprobó que diez rutas BFF usaban
`fetchSemseData()`, que obtiene la identidad estática del servidor. Otras ocho
eran request-aware, pero todavía podían caer en esa identidad como fallback.

Se creó `fetchSemseDataForAuthenticatedRequest()` para este tipo de superficie:
solo acepta headers saneados por middleware o una cookie de sesión firmada.
Todas las rutas internas fueron migradas a ese contrato.

## Regresiones

- CLIENT, PRO y WORKER reciben `ForbiddenException` en los handlers internos.
- OPS_ADMIN conserva acceso.
- El permiso interno no aparece en ningún rol externo.
- Las rutas exactas y subrutas de las cuatro páginas son admin-only.
- `/knowledge-base` no se clasifica accidentalmente como `/knowledge`.
- El inventario de 18 rutas BFF exige el helper autenticado.
- Ninguna ruta interna puede usar `fetchSemseData` ni
  `fetchSemseDataForRequest`, ambos capaces de fallback estático.
- El helper autenticado no referencia `resolveRuntimeConfig`.

## Validación local

- tests de paquete Auth: 30/30 pasan.
- tests de RBAC de dominio: 5/5 pasan.
- tests del boundary interno BFF/middleware: 3/3 pasan.
- auditoría RBAC deny-by-default: 2/2 pasan.
- `pnpm --filter @semse/auth build`: pasa.
- `pnpm --filter @semse/api build`: pasa.
- `pnpm --filter @semse/web build`: pasa; compilación y tipos válidos, 402
  páginas estáticas generadas.
- lint API: pasa.
- lint Web: 0 errores; 54 warnings preexistentes fuera del lote.
- SDD estricto: 104 specs, 0 errores, 0 warnings.
- cobertura del plan: 157/157.
- `git diff --check`: pasa.

## Gate operativo

Antes de elevar la spec Admin completa a `VERIFIED`:

1. con CLIENT, PRO y WORKER, comprobar redirección de las cuatro páginas;
2. con esos roles, comprobar 403 al invocar los endpoints internos;
3. con OPS_ADMIN, comprobar carga de árbol, nodo, relaciones, query y estado;
4. confirmar en logs que cada request conserva el `userId` de la sesión y no
   la identidad estática configurada para el servicio.

Este lote no fue desplegado ni probado contra producción.

## Rollback

Un rollback no puede devolver los mapas internos a `knowledge:read` ni permitir
que una sesión ausente se convierta en una llamada con identidad estática del
servidor.
