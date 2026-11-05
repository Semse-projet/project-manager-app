# Decisión de ingeniería T-008 / T-008b: priorizar integridad de fuentes

**Fecha:** 2026-11-05  
**Estado:** DIRECCIÓN TÉCNICA SELECCIONADA PARA DISEÑO Y PRUEBAS; **NO** es aprobación de la spec ni autorización de merge/producción.  
**Relaciones:** [spec #1075](https://github.com/Semse-projet/project-manager-app/pull/1075), [diagnóstico #1099 (cerrado sin fusionar)](https://github.com/Semse-projet/project-manager-app/pull/1099), [implementación T-008b #1101 (DRAFT)](https://github.com/Semse-projet/project-manager-app/pull/1101), [error de PPI #1087](https://github.com/Semse-projet/project-manager-app/issues/1087), [integridad de caché #1100](https://github.com/Semse-projet/project-manager-app/issues/1100).

## Decisión y motivo

1. **Primero T-008b — integridad de persistencia y procedencia.** `BlsPpiService` hoy fabrica una referencia `indexValue = 100` con `basePrice` cuando falla una serie. `MaterialPricingService.refreshPrices()` puede guardar ese precio con `source=BLS_PPI`, TTL renovado y contador `updated` exitoso, incluso cuando BLS solo devuelve parte de las series. Un registro anterior también podría sobreescribirse. Corregir solo la fórmula no evita atribuir a BLS una observación inexistente.
2. **Después T-008 — fórmula con base real fechada.** `basePrice × currentIndex / 100` no acredita un precio observado; se requiere `unitPriceAtBase × indexCurrent / indexAtBase` con **misma serie, escala y periodos comparables**, material, unidad, ubicación, `observedAt`, fuente, vigencia y derechos. Un índice positivo obtenido de BLS **no convierte** un `basePrice` anónimo en precio comercialmente verificado.
3. **Después consumidores.** `getCurrentPrices(): Record<string,number>` pierde procedencia; `PricingController.getMaterialPrices()` anuncia `BLS_PPI_CACHE` en caché vacío; ProTools pasa ese mapa a `ToolsService.calculate`, pero el total actualmente devuelto por `ProToolsAgent.estimate()` procede de su propio cálculo por reglas, no del resultado de la herramienta. No afirmar modificación de totales sin prueba end-to-end del consumidor específico.

## Contrato objetivo para implementar tras aprobación

| Etapa | Dato verificable | Si falta evidencia | Prohibición |
|---|---|---|---|
| Ingesta BLS | serie, mes, índice finito y estrictamente positivo, versión y escala | `PPI_UNAVAILABLE`, sin inventar un índice | índice ficticio 100 etiquetado como observado |
| Referencia comercial | precio/unit material, observación fechada, ubicación/proveedor, licencia, vigencia y mapeo de serie | `UNVERIFIED_PRICE` | convertir el índice por sí mismo en USD |
| Cálculo T-008 | índice base de la misma serie + índice actual comparable, redondeo documentado | ausencia de precio confirmado | `/100` universal |
| Persistencia T-008b | estado y fuente real por material, `fetchedAt` y `validUntil` de evidencia legítima | 0 escrituras de valor inventado; conservar snapshot previo/TTL sin renovarlo | `upsert` de fallback como `BLS_PPI` |
| API/ProTools | estado/procedencia por material, caché validado por fuente y fecha | respuesta degradada y trazable; no declarar precio verificado | `BLS_PPI_CACHE` global falso |

Para una respuesta parcial de BLS, procesar cada material de manera independiente. `updated` cuenta **solo escrituras autorizadas y verificadas**, `failed/unverified` cuenta ausencias; no renovar `validUntil` de otro material. El sistema no debe borrar, reemplazar ni recalcular estimados/contratos aceptados por esta transición.

## Secuencia ejecutable

- **P0a (diagnóstico):** [#1099](https://github.com/Semse-projet/project-manager-app/pull/1099) concluyó CI y se **cerró sin merge**; sus tests que afirman defectos siguen recuperables como evidencia histórica, no entran en `main`. Sus 24 escenarios sintéticos del contrato objetivo se copiaron íntegramente al PR existente [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101).
- **P0b (datos, investigación):** ejecutar únicamente con acceso autorizado la auditoría `COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.sql` descrita en #1075. No se ha ejecutado. Un `indexValue=100` coincidente es indicio, NO prueba histórica.
- **P1 (implementación propuesta, aún bloqueada para fusionar):** el **PR ya existente #1101**, en `DRAFT`, incluye protección del upsert ante fallbacks y metadatos `UNVERIFIED` para caché histórico/valores hardcoded, con pruebas de caída total, respuesta parcial, índices inválidos y consumidores. Es código propuesto no desplegado; falta revisión formal, aprobación de la spec y validación de compatibilidad. No crear otro PR para esta fase.
- **P2:** PR T-008 con observación base fechada y misma serie, goldens independientes de subida/igualdad/bajada y rechazo de referencias no verificables.
- **P3 (activación separada):** revisión Q11 legal, Q9 oficio, Q10 fiscal, T-005 datos reales y Q2/Q3/Q5/Q7, pruebas de consumidores/contratos y canary autorizado. Ningún gate de aritmética certifica precios o condiciones fiscales.

## Evidencia y estado de esta decisión

- #1076: T-004 (24×3) **fusionado a `main`** (squash `645ce3b80a8e2de6c39d3c57215222b0180de567`); aprobado matemáticamente, pero no comercialmente.
- #1099: diagnóstico sin alteraciones productivas, **CI terminal verde**, **cerrado sin merge**. Pruebas antiguas deliberadamente asertivas del defecto no son criterios correctos de regresión. Los 24 escenarios objetivo fueron conservados en #1101; la conclusión de pruebas independientes no demuestra que T-008 esté implementado.
- `MaterialPriceSnapshot` actual no tiene `observedAt` ni índice del periodo base. No atribuir legalmente a BLS precios hardcoded ni derivar historial de una fila sobrescrita.
- **Decisiones todavía abiertas:** Q2, Q3, Q5, Q7, Q9, Q10, Q11. La spec #1075 permanece `DRAFT` aun cuando su CI pase.

**No se autorizan** cambios en precios/IVA, migraciones, estados financieros, releases, merge ni servicios Railway por este documento.
