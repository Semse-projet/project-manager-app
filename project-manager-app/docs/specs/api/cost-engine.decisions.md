---
type: decisions
feature: "Motor de costos unificado"
spec: "docs/specs/api/cost-engine.spec.md"
version: "0.1"
status: "OPEN"
date: "2026-10-30"
---

# Expedientes de decisión — Motor de costos unificado (Q2, Q3, Q5, Q7, Q9, Q10, Q11)

> Documento maestro de la spec `api-cost-engine` (v0.3). **Ninguna decisión de este documento está aprobada.**
> Cada expediente reúne alternativas, riesgos, evidencia exigible, criterios de aceptación y responsable.
> **No contiene valores económicos inventados**: donde hace falta un número, aparece como `A DEFINIR` con quién
> debe definirlo. No autoriza fusionar #1075, cambiar precios en producción ni activar el motor.

## 0. Cómo leer este documento

### Etiquetas de verificación

| Etiqueta | Significado |
|---|---|
| **[REPO]** | Comprobado leyendo el código de `main` (rutas citadas). |
| **[WEB]** | Comprobado en una búsqueda web durante esta sesión (resumen de resultados; **no** lectura completa del documento). |
| **[CITADO]** | Lo afirma el owner o una auditoría externa; **no lo comprobé**. |
| **[PENDIENTE]** | Hace falta evidencia que aún no existe. |

### Plantilla (idéntica en los siete expedientes)

1. **Pregunta y por qué bloquea `APPROVED`**
2. **Estado actual** (hechos con etiqueta)
3. **Alternativas** (con ventajas, riesgos y reversibilidad)
4. **Recomendación provisional** (no aprobada)
5. **Evidencia necesaria** (qué datos o documentos, en qué formato)
6. **Criterios de aceptación exigibles** (pruebas o resultados verificables)
7. **Responsable y revisión profesional requerida**
8. **Riesgos si se decide mal**
9. **Dependencias**
10. **Fuentes**
11. **Estado de decisión** (`ABIERTA` → `EN REVISIÓN` → `DECIDIDA`; solo el owner la declara decidida)

### Prioridad de trabajo y dependencias

`Q9` (cantidades) y `Q11` (fuentes y licencias) → `Q10` (impuestos) → `Q2` (confianza) → `Q3` (valores y límites) → `Q5` (estimados desactualizados) → `Q7` (modo sombra).

- Q9 decide si el motor **puede recibir cantidades** desde el asistente. Sin Q9, el resto calcula sobre entradas inventadas.
- Q11 decide qué **precios** se pueden usar legalmente. Sin Q11, Q3 no tiene fuentes.
- Q3 depende de Q11 y de Q2. Q7 depende de Q2 y Q3 (qué diferencia es aceptable).
- Q10 depende de que el intake capture el tipo de contrato (hoy no lo captura, ver Q10).

### Pruebas obligatorias que conviene mantener (hallazgos de T-004, PR #1076)

- Normalización de `wastePercent`: `concrete` usa puntos porcentuales (0–30) y `masonry` fracción (0–0.35) **[REPO]**.
- Límite de `crewSize` de `project-manager` (1–20), que rechaza proyectos multi-oficio grandes **[REPO]**.
- Los motores deben exponer `costs.basis`, `effectiveRates` y `perUnitDivisor` en lugar de reconstruirlos por división (T-004b).

---

## Q9 — Mapeo de respuestas del asistente a cantidades del motor

### 1. Pregunta y por qué bloquea
¿Cómo se convierten las respuestas del asistente (en rangos y categorías) en las entradas numéricas que exigen los motores
(pies, metros cuadrados, cantidades)? Sin esto, el estimado por motor se alimenta de supuestos no revisados.

### 2. Estado actual
- El asistente hace **4 a 6 preguntas por categoría**; los motores esperan **7 a 14 campos de entrada** **[REPO]**
  (`apps/api/src/modules/smart-intake/config/questions/*`, `packages/tools/src/trades/*.engine.ts`).

| Categoría del asistente | Preguntas | Motor | Campos del motor |
|---|---|---|---|
| Pintura interior | 6 | painting | 10 |
| Pintura exterior | 5 | painting (parcial) | 10 |
| Drywall | 4 | drywall | 8 |
| Baño | 5 | bathroom | 8 |
| Cocina | 5 | kitchen | 7 |
| Limpieza | 4 | cleaning | 8 |
| Carpintería | 4 | carpentry | 11 |
| Plomería | 4 | plumbing | 14 |
| Electricidad | 4 | electrical | 9 |
| Pisos | 4 | flooring | 9 |
| Jardinería | 4 | landscaping | 10 |
| Techos | 4 | roofing | 13 |
| Climatización | 4 | hvac | 12 |
| Cercas y decks | 4 | fencing / deck | 9 / 11 |
| Albañilería y concreto | 4 | masonry / concrete | 9 / 8 |
| Demolición | 4 | demolition | 8 |
| Arreglos generales | 4 | **sin motor** | — |
| Mudanzas | 4 | **sin motor** | — |
| Lavado a presión | 4 | **sin motor** | — |

- Motores **sin categoría** en el asistente: aislamiento (insulation), revestimiento (siding), solar, azulejo (tile),
  ventanas y puertas (windows-doors), labor y project-manager **[REPO]**. (La pintura exterior no equivale a revestimiento.)
- Ejemplos de entradas del motor **sin pregunta equivalente**: plomería → `supplyLineFeet`, `drainLineFeet`, `waterHeaterReplace`,
  `gasWork`, `backflowPreventer`, `existingPipeCondition`; techos → `roofAreaSqFt` y `pitch` **[REPO]**.
- Las respuestas son **rangos** ("1 accesorio", "2–4", "toda la casa"), no cantidades continuas **[REPO]**.
- Las unidades difieren entre motores (`wastePercent`) **[REPO]**.

### 3. Alternativas
- **A. Mapeo tipado por categoría/oficio** con unidad, rango bajo/alto y regla de incertidumbre, versionado y probado. *Ventaja:* explícito
  y auditable. *Riesgo:* requiere revisión por especialistas de cada oficio. *Reversible:* sí.
- **B. Ampliar el cuestionario** para pedir los campos faltantes. *Ventaja:* menos suposiciones. *Riesgo:* más abandono; preguntas
  que un cliente no sabe responder (p. ej. pies de tubería). *Reversible:* sí.
- **C. Usar fotos/IA** para estimar cantidades. *Ventaja:* menos fricción. *Riesgo:* error no auditado; la IA no puede ser autoridad
  económica. **No recomendada como primera fuente.**
- **D. Mantener la fórmula plana** donde no haya mapeo revisado. *Ventaja:* seguro. *Riesgo:* queda el rango ancho conocido.

### 4. Recomendación provisional
A, categoría por categoría y empezando por las de menor riesgo, con B solo para las preguntas de mayor impacto; D como respaldo
explícito para categorías sin mapeo revisado (incluidas las tres sin motor). C solo como señal secundaria con revisión humana.

### 5. Evidencia necesaria
- Por categoría: tabla `respuesta → {unidad, bajo, alto, supuesto}` con ejemplos reales de trabajos terminados.
- Mediciones o presupuestos reales por oficio que validen los rangos (fuente, fecha, región).
- Lista de campos del motor que **no** pueden inferirse y qué valor por defecto declarado se usará.

### 6. Criterios de aceptación
- Cada categoría mapeada tiene una prueba de tabla (respuesta → entradas) y las entradas resultantes son **válidas** para el motor.
- El rango del estimado se obtiene ejecutando el motor con los escenarios bajo y alto; ninguna respuesta "no estoy seguro" produce una cifra puntual.
- Un especialista del oficio firma la tabla de su categoría (nombre, fecha, alcance de la revisión).
- La unidad de cada campo está documentada y probada (incluye `wastePercent`).

### 7. Responsable y revisión
Especialistas de campo por oficio (revisión de rangos), producto (cuestionario), ingeniería (adaptador). **Revisión profesional obligatoria.**

### 8. Riesgos si se decide mal
Cantidades irreales presentadas con aspecto de precisión; estimados que no coinciden con el costo final; pérdida de confianza.

### 9. Dependencias
T-004c (`wastePercent`), Q2 (qué se llama "confianza"), Q3 (valores por defecto).

### 10. Fuentes
Código citado en §2 **[REPO]**. Informe T-004 (`docs/reportes/COST_ENGINE_T004_DIAGNOSTICS_2026-10-30.md`).

### 11. Estado
`ABIERTA`. Siguiente paso: elegir 2 categorías piloto y conseguir revisión de especialistas **[PENDIENTE]**.

---

## Q11 — Fuentes de precios y licencias

### 1. Pregunta y por qué bloquea
¿De dónde pueden venir, legalmente y con trazabilidad, los precios, salarios, rendimientos y multiplicadores del motor?

### 2. Estado actual
- **Ningún** archivo de `packages/tools/src/trades/` documenta la procedencia de sus precios (sin fuente, fecha ni proveedor);
  14 archivos declaran constantes de costo o precio fijas **[REPO]**.
- `bls-ppi.service.ts` mantiene 12 precios base "promedios de mercado de 2024" sin fuente ni fecha por material, y reutiliza una
  misma serie PPI para materiales distintos (p. ej. `WPU132` para concreto premezclado, bloque y ladrillo) **[REPO]**.
- `location-cost.service.ts` declara que su tabla estática de multiplicadores de material es **"RSMeans 2023 City Cost Index —
  state-level approximations"** **[REPO]**. Puede implicar uso de datos con licencia restringida.
- `oews.service.ts` conserva multiplicadores estáticos "validados contra datos 2022–2023" **[REPO]**.
- Licencia de RSMeans: los avisos de las publicaciones y el *addendum* de Trimble prohíben integrar los datos en software o
  bases de datos y limitan el uso a la estimación propia del licenciatario; Gordian ofrece acceso por API/archivo plano bajo
  **términos comerciales separados** **[WEB]**. El número de sección exacto que cita el owner (Addendum 1, §2.2) **no lo pude confirmar** **[CITADO]**.
- BLS publicó los datos OEWS de mayo de 2025 el **15 de mayo de 2026** **[WEB]**. Que el PPI mide variaciones y no precios
  unitarios lo afirma la auditoría **[CITADO]**; el código lo contradice en la práctica (`precio = base × índice/100`) **[REPO]**.

### 3. Alternativas
- **A. Fuentes públicas oficiales** (BLS OEWS para salarios, BLS PPI para variación) y **precios observados propios** con proveedor,
  unidad, ubicación y fecha. *Ventaja:* sin licencias restrictivas. *Riesgo:* esfuerzo de captura y cobertura desigual.
- **B. Licencia comercial con derechos de integración** (p. ej. un acuerdo con Gordian). *Ventaja:* datos de referencia
  reconocidos. *Riesgo:* costo, condiciones SaaS y dependencia de proveedor; requiere contrato revisado.
- **C. Cotizaciones reales de proveedores y contratistas** (red SEMSE). *Ventaja:* representa el mercado real de SEMSE. *Riesgo:* sesgo y
  mantenimiento.
- **D. Mantener las tablas actuales** como "referencia histórica no validada". *Riesgo:* licencia no resuelta; precisión no demostrada.

### 4. Recomendación provisional
A + C como base y B solo si el valor lo justifica y el contrato lo permite; D únicamente etiquetada como **no validada**, y
**retirar o sustituir** la tabla atribuida a RSMeans hasta que Legal confirme que se puede usar.

### 5. Evidencia necesaria
- Por cada dato de precio: fuente, proveedor, ubicación, unidad, fecha, vigencia y licencia/permiso de uso en SaaS.
- Dictamen jurídico sobre la tabla `STATIC_MATERIAL_MULTIPLIERS` y sobre cualquier dato de terceros.
- Si se elige B: texto del contrato con derechos de integración, almacenamiento y reutilización.

### 6. Criterios de aceptación
- Ningún precio, multiplicador o rendimiento llega a producción sin registro de procedencia (modelo `MaterialPriceObservation` de la spec).
- El PPI solo se usa con **precio de referencia fechado** y el índice de esa fecha (corrección P0).
- Dictamen jurídico archivado antes de usar cualquier dato de terceros con restricciones.
- La procedencia de cada valor es visible para el rol admin y reproducible en la traza.

### 7. Responsable y revisión
Datos (inventario y captura), **Legal (licencias)**, finanzas (aceptación de fuentes).

### 8. Riesgos si se decide mal
Infracción de licencia; precios no defendibles ante una disputa; estimados engañosos.

### 9. Dependencias
Q3 (valores), Q2 (calibración), T-008 (corrección PPI).

### 10. Fuentes
- [BLS — OEWS, publicación de mayo de 2025](https://www.bls.gov/news.release/archives/ocwage_05152026.htm) **[WEB]**.
- [RSMeans — Trimble, acuerdo de licencia](https://www.trimble.com/downloads/5b7enCv3RLz3iPG00pKPQT/92cf06f5642fff215e58dcab4df775a6/RSMeans_License_Agreement.pdf) **[WEB]** (extractos).
- [Gordian — hoja de producto de RSMeans](https://www.gordian.com/uploads/2021/10/RSMeans_data_One_Sheet_10142021_high.pdf) **[WEB]** (integración por API bajo términos separados).
- `apps/api/src/modules/pricing/{bls-ppi,oews,location-cost}.service.ts` **[REPO]**.

### 11. Estado
`ABIERTA`. Borrador de nota para Legal: `docs/specs/api/cost-engine.q11-legal-note.md` (sin enviar). Siguiente paso: que el owner la revise y la envíe **[PENDIENTE]**.

---

## Q10 — Política fiscal

### 1. Pregunta y por qué bloquea
¿Cómo se calculan los impuestos del estimado, ahora que el 7 % universal no es defendible?

### 2. Estado actual
- `buildCostSummary` aplica `taxRate = 7 %` sobre el subtotal con márgenes y comisión, y **los 72 escenarios de T-004 usan exactamente 7 %** **[REPO]**.
- El intake **no captura el tipo de contrato** (precio global, costo más honorarios, tiempo y materiales, o venta minorista con
  instalación) **[REPO]** (`ProjectIntake` solo guarda categoría, ubicación, respuestas y estimado).
- Florida: el Departamento de Ingresos publica la guía **GT-800007 "Sales and Use Tax on Building Contractors"**. En contratos de
  precio global, costo más honorarios/precio garantizado y tiempo y materiales, el contratista es consumidor final de los
  materiales y el impuesto recae sobre ellos; la **estructura del contrato** determina el tratamiento (p. ej. TAA 15A-019, TAA
  10A-042); la tasa depende del **condado de entrega** **[WEB]**. Esto respalda quitar el 7 % universal. **No** certifica una política lista
  para producción.
- La regla 12A-1.051(3) F.A.C. clasifica los contratos de mejoras de inmuebles en cinco categorías de precio **[WEB]**.

### 3. Alternativas
- **A. `TaxPolicy` versionada, alcance limitado y documentado para Florida**, con estado "impuestos no determinados" fuera de él.
  *Ventaja:* honesta y acotada. *Riesgo:* necesita capturar el tipo de contrato y el condado.
- **B. No calcular impuestos en el estimado preliminar** y mostrar solo el subtotal con un aviso. *Ventaja:* evita errores fiscales.
  *Riesgo:* el cliente no ve el costo total.
- **C. Mantener un porcentaje configurable.** *Riesgo:* repite el error actual con otra cifra.
- **D. Integrar un servicio de cálculo fiscal externo.** *Ventaja:* tasas por ubicación. *Riesgo:* costo, privacidad y dependencia.

### 4. Recomendación provisional
B de inmediato para cualquier jurisdicción sin política revisada, y A para Florida cuando exista revisión fiscal; **no** sustituir el 7 % por otro porcentaje genérico.

### 5. Evidencia necesaria
- Taxonomía de contratos de SEMSE mapeada a las categorías de la regla 12A-1.051(3).
- Casos de prueba firmados por un profesional fiscal (precio global, costo más honorarios, T&M, venta con instalación) con el resultado esperado.
- Fuente y fecha de las tasas por condado.

### 6. Criterios de aceptación
- Sin `TaxPolicy` vigente, el estimado muestra "impuestos no determinados" y no aplica ninguna tasa por defecto.
- Cada `TaxPolicy` guarda jurisdicción, tipo de contrato, componentes gravables, versión, vigencia y revisor.
- La traza incluye la política y su versión; los estimados aceptados no cambian al modificar una política.
- Un profesional fiscal competente aprueba por escrito el alcance inicial.

### 7. Responsable y revisión
Finanzas + **profesional fiscal competente (obligatorio)**; producto (captura del tipo de contrato); ingeniería.

### 8. Riesgos si se decide mal
Cobros o presupuestos fiscalmente incorrectos; exposición ante el cliente y las autoridades.

### 9. Dependencias
Q1 (doble control para políticas), cambio en el intake para capturar contrato y condado, Q5 (cambio de política vuelve obsoleto un borrador).

### 10. Fuentes
- [Florida DOR — GT-800007, Sales and Use Tax on Building Contractors](https://www.floridarevenue.com/Forms_library/current/gt800007.pdf) **[WEB]**.
- [Florida DOR — TIP 03A01-21](https://floridarevenue.com:443/taxes/tips/documents/TIP_03A01-21.pdf) (condado de entrega) **[WEB]**.
- [Florida DOR — TAA 15A-019](https://floridarevenue.com/TaxLaw/Documents/15A-019.pdf) **[WEB]**.
- Varias firmas contables y blogs resumen estas reglas; son fuentes secundarias y **no** deben usarse como base de una política.

### 11. Estado
`ABIERTA`. Siguiente paso: decidir si el estimado preliminar muestra impuestos o solo subtotal (B) **[PENDIENTE: owner]**.

---

## Q2 — Confianza del estimado

### 1. Pregunta y por qué bloquea
¿Cuándo puede una estimación llamarse de "confianza alta" y qué evidencia lo respalda?

### 2. Estado actual
- La etiqueta actual depende de la **puntuación de precisión**, que mide cuántos campos se respondieron: genérico `≥ 60` → "alta", `≥ 35` → "media";
  pintura `≥ 80` → "alta" **[REPO]** (`smart-intake.logic.ts`). **No mide el error real contra costos finales.**
- Medido en producción: plomería con precisión 90 % mostró **$109 – $1,638** con "high confidence" **[REPO/observado]**.
- Estructuralmente, un intake se enlaza con un trabajo (`publishedJobId`), y los trabajos tienen `budgetMin/Max` (rango del cliente) y
  contratos/hitos con montos; **no hay un campo de "costo final real" por categoría** **[REPO]**. No sé si existe volumen suficiente de
  casos terminados **[PENDIENTE]**.
- GAO (GAO-20-195G, 2020): derivar datos de riesgo de **datos históricos** cuando sea posible, comprobar que son aplicables y **no usar
  porcentajes arbitrarios**; con datos de mala calidad se genera una falsa sensación de seguridad **[WEB]**. AACE 56R-08 es la práctica
  más aplicable a edificación; distingue madurez del alcance y exactitud **[CITADO]**.

### 3. Alternativas
- **A. Tres estados:** *preliminar* → *revisado por un profesional* → *calibrado* (con evidencia retrospectiva). La confianza alta solo en *calibrado*.
- **B. Mantener la puntuación por preguntas respondidas.** Rápido; repite el problema actual.
- **C. Ancho de rango fijo por precisión** (como la v0.1). Simple; sin fundamento y contrario a GAO/AACE.
- **D. Sin etiqueta de confianza**, solo rango y supuestos. Honesto; menos orientación.

### 4. Recomendación provisional
A (con D como comportamiento por defecto mientras no haya calibración). Retirar la etiqueta "high" basada solo en preguntas respondidas.

### 5. Evidencia necesaria
- Dataset de estimados vs. costos reales por **oficio, región y complejidad**, con tamaño de muestra y fecha.
- Definición de "costo real" (contratado, pagado, o ajustado por órdenes de cambio) y qué casos se excluyen.
- Métrica de error elegida (p. ej. error relativo mediano y percentiles) **A DEFINIR** por costos y especialista del oficio.

### 6. Criterios de aceptación
- La confianza "calibrada" solo se asigna con muestra y error medidos para ese oficio, región y complejidad, registrados en la traza.
- Sin calibración, la etiqueta es "Preliminar" y el rango es el que sale del motor.
- Los supuestos que generan la incertidumbre se listan en el estimado.
- Prueba: ningún estimado muestra "calibrado" cuando no existe un registro de calibración vigente.

### 7. Responsable y revisión
Costos/finanzas, especialista de cada oficio, datos. **Revisión estadística** del criterio de calibración.

### 8. Riesgos si se decide mal
Falsa precisión; reclamos por estimados muy por debajo del precio final; incentivo a "inflar" confianza.

### 9. Dependencias
Q9 (cantidades), Q3 (valores), disponibilidad de datos históricos.

### 10. Fuentes
- [GAO — Cost Estimating and Assessment Guide, capítulo 12 (riesgo e incertidumbre)](https://gaoinnovations.gov/cost-guide/chapter-12-step-9-conduct-risk-and-uncertainty-analysis.html) **[WEB]**.
- [GAO — Aplicabilidad de los datos](https://gaoinnovations.gov/cost-guide/data-applicability.html) **[WEB]**.
- AACE 56R-08 **[CITADO]**.
- `smart-intake.logic.ts` **[REPO]**.

### 11. Estado
`ABIERTA`. Borrador de la auditoría de datos (SQL de solo lectura, **sin ejecutar**): `docs/specs/api/cost-engine.q2-data-audit.md` y `.sql`. Siguiente paso: revisión de autorización, rendimiento, aislamiento y privacidad **[PENDIENTE]**.

---

## Q3 — Valores por defecto y límites de los parámetros

### 1. Pregunta y por qué bloquea
¿Qué valores y límites tiene el registro de parámetros (márgenes, tarifas, comisión)?

### 2. Estado actual
- Hoy rigen **valores fijos del código**: comisión 5 %, impuesto 7 %, overhead/ganancia por defecto 15 %/20 %, y márgenes propios por
  oficio que en 14 de 24 motores cambian con la entrada (tabla en `docs/reportes/COST_ENGINE_T004_DIAGNOSTICS_2026-10-30.md`) **[REPO]**.
- Los límites propuestos en la spec (p. ej. overhead 0–40 %, ganancia 0–50 %, multiplicadores 0.5–2.0) son una **propuesta sin base de datos** **[REPO/spec]**.
- La tarifa nacional de referencia (`NATIONAL_BASELINE_HOURLY_RATE`) promedia 12 oficios de OEWS **[REPO]** y no es una tarifa facturable **[CITADO]**.

### 3. Alternativas
- **A. Conservar los valores actuales como "referencia histórica no aprobada"** y fijar límites **por tipo de parámetro**. Los motores siguen igual; los límites impiden valores extremos.
- **B. Recalibrar con datos reales** de margen y costos indirectos antes de publicar el registro. Más defendible; requiere Q11 y Q2.
- **C. Sin límites** (confiar en el administrador). Riesgo operativo alto.

### 4. Recomendación provisional
A ahora (sin presentarlos como aprobados) y B cuando exista evidencia. Límites mínimos y máximos por tipo de parámetro, **aprobados por finanzas**.

### 5. Evidencia necesaria
Costos indirectos y márgenes reales por oficio; tarifas facturables verificadas (seguros, cargas, traslado); análisis de sensibilidad del total ante cada parámetro; rentabilidad objetivo.

### 6. Criterios de aceptación
Cada parámetro del registro tiene: valor por defecto con su procedencia, mínimo y máximo aprobados, capas que pueden modificarlo y prueba de límites;
los valores históricos están etiquetados "no aprobados" hasta que finanzas los firme.

### 7. Responsable y revisión
Finanzas y especialistas de oficio. **Revisión financiera obligatoria** para comisión y márgenes.

### 8. Riesgos si se decide mal
Márgenes irreales; precios fuera de mercado; comisión modificada por error.

### 9. Dependencias
Q11 (fuentes), Q2 (calibración), Q1 (doble control para comisión).

### 10. Fuentes
Informe T-004 y `cost-engine.ts`/`contractor-rate.service.ts` **[REPO]**.

### 11. Estado
`ABIERTA`.

---

## Q5 — Estimados desactualizados

### 1. Pregunta y por qué bloquea
¿Qué pasa cuando cambian los precios, el alcance o una política después de que se generó un estimado?

### 2. Estado actual
- El estimado se guarda en `ProjectIntake.generatedEstimateJson` con `generatedAt`, **sin versión del motor ni de los parámetros** **[REPO]**.
- Smart Intake **regenera** el estimado al cambiar las respuestas **[REPO]**. El refresco de precios ocurre por un trabajo programado con caché de 7 días **[REPO]** (`price-refresh.job.ts`, `location-cost.service.ts`).
- No existe un concepto de "estimado desactualizado" **[REPO]**.

### 3. Alternativas
- **A. Avisar y permitir regeneración explícita** de borradores cuando cambie un parámetro relevante; los importes aceptados nunca cambian.
- **B. Regenerar automáticamente los borradores.** Menos fricción; riesgo de cambios inesperados para el cliente.
- **C. No avisar.** Simple; deja estimados viejos sin señal.

### 4. Recomendación provisional
A. Definir qué cambios vuelven "obsoleto" un borrador (versión del motor, política fiscal, parámetros de su capa, precios más allá de su vigencia).

### 5. Evidencia necesaria
Casos de actualización por tipo de cambio; versionado de motor y parámetros; pruebas de inmutabilidad de importes aceptados; criterio de producto para el aviso.

### 6. Criterios de aceptación
- Un cambio relevante marca el borrador como "desactualizado" y muestra el motivo; solo una acción explícita lo regenera.
- Un estimado **aceptado**, un contrato, un hito o un escrow no cambian en ningún caso (prueba negativa).
- Cada estimado guarda las versiones usadas en su traza.

### 7. Responsable y revisión
Producto y contratos (qué significa "aceptado"); ingeniería.

### 8. Riesgos si se decide mal
Importes cambiados sin consentimiento; disputas; clientes con presupuestos viejos.

### 9. Dependencias
Traza de cálculo (spec §5), Q10 (políticas), Q3.

### 10. Fuentes
`ProjectIntake`, `smart-intake.service.ts`, `price-refresh.job.ts` **[REPO]**.

### 11. Estado
`ABIERTA`.

---

## Q7 — Modo sombra

### 1. Pregunta y por qué bloquea
¿Cuándo termina el modo sombra y se puede activar el motor para Smart Intake?

### 2. Estado actual
- No existe infraestructura de modo sombra ni métricas de comparación **[REPO]**. La spec define el flag `COST_ENGINE_SHADOW` y el comportamiento esperado (servir el cálculo actual y registrar la diferencia) **[REPO/spec]**.

### 3. Alternativas
- **A. Salida por cobertura y calidad** (mínimo de muestras representativas por categoría y región, diferencias dentro de lo aprobado, sin fallos, sin regresión de latencia).
- **B. Salida por tiempo** (cierto número de días). Simple; puede cerrar con datos insuficientes.
- **C. Por categoría**: cada categoría sale de la sombra cuando cumple A. Reduce riesgo; más seguimiento.

### 4. Recomendación provisional
A aplicada por categoría (C). **No** usar solo el tiempo transcurrido.

### 5. Evidencia necesaria
Diferencias motor/fórmula por oficio y región, tasa de fallos del motor, latencia p95, representatividad de la muestra. Los umbrales concretos
(`N` de muestras, diferencia aceptable, tasa de fallo máxima) son **A DEFINIR** por ingeniería, operaciones y quien resuelva Q2/Q3.

### 6. Criterios de aceptación
- Informe por categoría con muestra, distribución de diferencias y fallos, revisado por producto y un especialista.
- La sombra no cambia la respuesta ni la bloquea ante fallos del motor (prueba).
- Regla de salida escrita y aprobada **antes** de iniciar la sombra.

### 7. Responsable y revisión
Ingeniería y operaciones; producto aprueba la regla de salida.

### 8. Riesgos si se decide mal
Activar con muestra insuficiente; falsa seguridad; regresión de latencia.

### 9. Dependencias
Q2 y Q3 (qué diferencia es aceptable), Q9 (mapeo por categoría), flags separados.

### 10. Fuentes
Spec `api-cost-engine` §4 P5 y §8 **[REPO]**.

### 11. Estado
`ABIERTA`.

---

## Registro de decisiones

| Pregunta | Estado | Responsable principal | Revisión profesional | Bloquea |
|---|---|---|---|---|
| Q9 | ABIERTA | Especialistas de oficio | Obligatoria | `APPROVED` |
| Q11 | ABIERTA | Datos + Legal | Obligatoria (jurídica) | `APPROVED` |
| Q10 | ABIERTA | Finanzas + fiscal | Obligatoria (fiscal) | `APPROVED` |
| Q2 | ABIERTA | Costos + especialistas | Estadística | `APPROVED` |
| Q3 | ABIERTA | Finanzas | Obligatoria (financiera) | `APPROVED` |
| Q5 | ABIERTA | Producto + contratos | Recomendada | `APPROVED` |
| Q7 | ABIERTA | Ingeniería + operaciones | No | Activación |

Una decisión pasa a `DECIDIDA` solo cuando el owner lo declara por escrito, con la evidencia y la revisión profesional que exige su sección.
