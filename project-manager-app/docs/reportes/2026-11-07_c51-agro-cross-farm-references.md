# C51 — agro: referencias entre fincas en ciclos de cultivo, insumos y trazabilidad

Fecha: 2026-11-07 · Alcance: un módulo (`modules/agro`) · C51 sigue **PARTIAL**.

## Evaluación
Los 19 endpoints de agro que la guarda de arquitectura marca sin evidencia de scope usan otro modelo de acceso: la
finca pertenece a un **usuario** (`AgroFarm.ownerId`), no a tenant/org, y cada ruta comprueba al dueño (también al
cargar ciclos, ciclos de cultivo y chequeos por id). Ese modelo no se cambia ni se migra a `ProjectScope`.

## Hallazgo y cambio
Los ids que llegan en el cuerpo no se validaban contra la finca:
- `POST /v1/agro/farms/:farmId/crop-cycles`: `productionCycleId` y `fieldUnitId`.
- `POST /v1/agro/crop-cycles/:cropCycleId/inputs`: `fieldUnitId`.
- `POST /v1/agro/farms/:farmId/traceability`: `productionCycleId`.

Así, el dueño de la finca A podía colgar ciclos de cultivo o eventos de trazabilidad (con descripción y
`evidenceUrls` propios) de un ciclo de la finca B, que `GET /v1/agro/cycles/:cycleId` muestra al dueño de B porque
incluye `cropCycles` y `traceability`; o enlazar una parcela de B, cuyo nombre devuelve el listado de ciclos de
cultivo de A. Ahora esos ids deben pertenecer a la misma finca; si no, 404 sin escribir. Requería conocer el id
(cuid) del recurso ajeno.

## Pruebas
- Nueva `apps/api/test/agro-cross-farm-references.test.ts` (5).
- Mutaciones: sin la comprobación de ciclos de cultivo/insumos fallan 2 pruebas; sin la de trazabilidad, 1; restaurado, 5/5.
- Suite `@semse/api test:unit`: 3872 pass, 0 fail, 2 skipped. Suite raíz `pnpm test:unit`: 1642 pass, 0 fail. ESLint limpio.

## Pendiente / límites
- No se auditaron filas existentes con referencias cruzadas (requiere acceso de solo lectura a la base).
- `entityId` de trazabilidad y de compliance es polimórfico y solo se lee filtrado por la finca; no se validó.
- Sin smoke autenticado en producción; no se declara despliegue (el Railway Deploy de `main` falla por el token).
