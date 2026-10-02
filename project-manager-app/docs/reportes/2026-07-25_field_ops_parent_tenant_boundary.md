# Field Ops 2.49 — frontera tenant de relaciones padre/hijo

Fecha: 2026-07-25
Plan: `2.49 CRÍTICO`
Spec: `api-field-ops` v1.1 (`IMPLEMENTED`)

## Resultado

- Crear una unidad exige que `projectId` pertenezca al tenant de sesión.
- Crear un worklog exige que `fieldUnitId` pertenezca al tenant.
- Crear un fact con `worklogId` exige que ese worklog pertenezca al tenant; el
  enlace sigue siendo opcional.
- Crear o actualizar compliance exige que `vendorId` pertenezca al tenant antes
  de buscar o escribir documentos.
- Un target inexistente o foráneo responde como no encontrado y no ejecuta la
  escritura hija.

La defensa se implementó en el repositorio, por lo que protege a todos los
callers. Queda pendiente una prueba DB con dos tenants y evaluar relaciones
compuestas `{id, tenantId}` como defensa adicional de esquema.

## Validación

- [x] 5/5 regresiones nuevas de parent scoping.
- [x] 37/37 pruebas Field Ops dirigidas.
- [x] Build API.
- [x] ESLint API completo: 0 errores y 0 advertencias.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 161/161 hallazgos, sin faltantes ni extras.

No se hizo push, deploy ni mutación de producción.
