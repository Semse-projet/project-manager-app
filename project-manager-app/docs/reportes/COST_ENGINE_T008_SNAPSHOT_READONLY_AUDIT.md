# T-008 / T-008b — Auditoría de procedencia de caché PPI (solo lectura)

**Estado:** preparada, **NO EJECUTADA contra la base de producción**. Revisión de código y esquema a 2026-11-05. Relacionado: [#1075](https://github.com/Semse-projet/project-manager-app/pull/1075), [#1099](https://github.com/Semse-projet/project-manager-app/pull/1099), [#1087](https://github.com/Semse-projet/project-manager-app/issues/1087), [#1100](https://github.com/Semse-projet/project-manager-app/issues/1100).

## Objetivo y límites

Determinar si el estado **actual** de `MaterialPriceSnapshot` presenta señales de índices/valores inválidos, atribución dudosa a BLS PPI o expiraciones incoherentes. Los diagnósticos del PR #1099 muestran que, ante error externo o respuesta parcial, el servicio puede persistir precios `basePrice` hardcoded como `source=BLS_PPI`, `indexValue=100`, con una vigencia nueva. **Esto no demuestra que haya sucedido en producción.**

Archivo SQL: [COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.sql](COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.sql). Solo contiene transacción `READ ONLY`, consultas `SELECT` y `COMMIT`; emite agregados, nunca filas de clientes, credenciales, proyectos ni contratos.

## Cómo verificar sin alterar producción

1. Antes de consultar, confirmar permiso y ámbito de acceso. Usar una **identidad PostgreSQL de solo lectura**, conexión interna autorizada y sesión con límites de tiempo de consulta. No abrir nuevos proxies públicos ni incorporar secretos al repositorio.
2. Ejecutar el SQL en la base destino autorizada mediante un cliente PostgreSQL; conservar exclusivamente agregados, fecha UTC, nombre del entorno y hash del commit, sin copiar secretos ni registros personales.
3. Revisar las métricas resultantes de Q1 (totales/índices inválidos), Q2 (procedencia por fuente) y Q3 (fecha de actualización), después contrastar con los eventos reales de `MaterialPricingService.refreshPrices`, las ventanas de indisponibilidad BLS y la configuración de `PriceRefreshJob`. Mantener las observaciones por entorno separadas.

**No ejecutar por defecto una tarea de refresco ni un `upsert` como parte de esta auditoría.** No lanzar cambios de variable de producción sin una decisión operativa y plan de reversión; el registro de precios existente no debe sobreescribirse para diagnosticarlo.

## Interpretación

- `possible_fallback_not_proven` cuenta filas que coinciden con `indexValue=100` y `pricePerUnit=basePrice` bajo `BLS_PPI`. **No es una prueba de fallback**: un índice válido puede ser 100, un precio puede coincidir con la base por casualidad y la tabla carece de observación histórica.
- `bls_missing_or_invalid_index`, `non_positive_prices` y `inconsistent_ttl` son anomalías verificables en el estado actual, pero no demuestran por sí mismas que un estimado haya sido afectado.
- `currently_valid_ttl` refleja caducidad técnica del caché, **no** vigencia ni procedencia comercial de un precio.
- Las columnas `fetchedAt` y `updatedAt` no preservan la historia del registro; el `upsert` por `materialKey` reemplaza el estado. Si faltan logs o snapshots anteriores, **la cantidad histórica de sobrescrituras es indeterminable**.
- El modelo actual no contiene `observedAt`, `baseIndexPeriod` ni estado `VERIFIED/UNVERIFIED`: esa ausencia impide certificar un precio con esta tabla solamente.

## Gate de decisión

- Si aparecen cantidades no válidas, priorizar aislamiento/revisión con política de no sobrescribir datos, respaldos y trazabilidad antes de cualquier reparación. Una consulta agregada no autoriza saneamiento de filas.
- Si todos los contadores problemáticos son cero, **no cerrar #1087 ni #1100**: las pruebas reproducen rutas inseguras bajo condiciones sintéticas y falta evidencia histórica.
- La corrección exige T-008 (índice del período base), T-008b (persistencia fail-closed), T-005 (precios reales), Q10 (fiscalidad) y Q11 (fuentes/licencias). La validación matemática T-004 es un gate separado.

**Responsable de ejecución:** operador autorizado de datos; **resultado actual:** PENDIENTE. No se consultó PostgreSQL ni se modificó Railway al preparar este expediente.
