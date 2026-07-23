# Admin UI Remediation — Batch 5

**Fecha:** 2026-07-23  
**Rama:** `devin/1784817088-admin-remediation-ids-pagination`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.5

## Resumen

Se corrigió el problema de **IDs crudos (UUID) en vez de nombres** y la **falta de paginación** en las tres listas de Admin identificadas: `/admin/labor-engine`, `/admin/disputes` y `/admin/users`.

## Cambios

### `apps/web/app/components/admin/Pagination.tsx` (nuevo)
- Componente compartido de paginación simple (Anterior/Siguiente + contador de página).

### `apps/web/app/(app)/admin/labor-engine/page.tsx`
- Carga `users` en `load()` y mantiene un mapa `userById`.
- En timers activos y en la tabla de equipo se muestra `displayName(userId)` (parte local del email) en lugar del UUID crudo.
- El target del timer ahora muestra el `title` del job si está disponible, o el UUID truncado como fallback.
- Las alertas QualityGuard usan el nombre legible del worker en el label y en los mensajes de confirmación.
- Paginación de 8 items para timers activos y equipo.

### `apps/web/app/(app)/admin/disputes/page.tsx`
- Carga `users` para enriquecer `client`/`worker` cuando solo se tenga el ID.
- En cada fila de disputa se muestra `displayName(clientId, client) vs displayName(workerId, worker)`.
- Paginación de 10 items para la lista de disputas; se resetea a página 0 al cambiar filtros.

### `apps/web/app/(app)/admin/users/page.tsx`
- Paginación de 10 items sobre el listado filtrado.
- Reset a página 0 al cambiar query/rol/estado.

### `docs/AUDIT_REMEDIATION_PLAN.md`
- Item 3.5 marcado como `[x]` con nota de pendiente de verificación en vivo.

### `docs/specs/ui/admin-flows-remediation.spec.md`
- Checklist actualizado con el nuevo criterio de paginación/nombres.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores
- `pnpm spec:preflight` — pasa

## Pendiente

- Verificación en vivo con credencial `OPS_ADMIN` para confirmar que los nombres y controles de paginación se renderizan correctamente con datos reales.
